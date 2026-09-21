import admin from 'firebase-admin';
import chatSecurity from '../lib/chat-security.js';

const { validateChatRequest, verifyUserEmailStatus, MemoryRateLimiter, identityKey, clientIp, upstreamTimeout, sseError, providerStatusError, logProviderError } = chatSecurity;

// --- Firebase Admin SDK Initialization (runs once per cold start) ---
if (!admin.apps.length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable not set.");
    }
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

// Tier-1 rate limiting (in-memory, per warm instance)
const chatLimiter = new MemoryRateLimiter();

// --- Main Serverless Function Handler ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // --- Auth: Bearer token in the Authorization header ONLY (never query params) ---
    let idToken;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        idToken = authHeader.slice('Bearer '.length).trim();
    }
    if (!idToken) {
        return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }

    let uid = null;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const emailStatus = verifyUserEmailStatus(decodedToken);
        if (!emailStatus.allowed) {
            return res.status(emailStatus.code).json({ error: emailStatus.error });
        }
        uid = decodedToken.uid;
    } catch {
        console.error('[chat] token verification failed');
        return res.status(403).json({ error: 'Unauthorized: Invalid token.' });
    }

    // --- Rate limit per uid (fall back to hashed IP) ---
    const rl = chatLimiter.check(identityKey(uid, clientIp(req)));
    if (!rl.allowed) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({ error: 'Rate limit exceeded. Please wait before sending more messages.' });
    }

    // --- Shared validation & limits ---
    const v = validateChatRequest(req.body);
    if (!v.ok) {
        return res.status(v.code).json({ error: v.message });
    }
    const { model, cleanedMessages, chatOptions } = v;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // ':free' models ALWAYS route to OpenRouter — the org prefix (openai/,
    // google/, nvidia/, meta-llama/…) is the upstream publisher on OpenRouter,
    // not a direct-provider routing key.
    const isOpenRouterFree = model.endsWith(':free');
    const isGoogle = !isOpenRouterFree && model.startsWith('google/');
    const isGroq = !isOpenRouterFree && model.startsWith('groq/');
    const isNvidia = !isOpenRouterFree && model.startsWith('nvidia/');

    // Per-message composer options (v1.0.3 B3/B4). Free-tier rule: these are
    // applied ONLY when the user explicitly toggled a chip — never always-on.
    // OpenRouter models take the `:online` suffix; Gemini takes google_search
    // grounding / thinkingConfig; Groq/NVIDIA offer neither (chips are disabled
    // client-side and ignored here), so the flags stay false for them.
    // ':online' cannot stack on ':free' — web search is a paid-model feature.
    const useWebSearch = !!chatOptions.webSearch && !isGroq && !isNvidia && !isOpenRouterFree;

    try {
        if (isGoogle) {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error('GEMINI_API_KEY not configured.');
            const googleModelName = model.split('/')[1];
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(googleModelName)}:generateContent`;
            const requestBody = transformMessagesForGoogle(cleanedMessages, chatOptions);
            const response = await fetch(apiUrl, {
                method: 'POST',
                signal: upstreamTimeout(),
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey // key in header, never in URL
                },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                providerStatusError(res, 'google', response.status);
                return;
            }
            const fullData = await response.json();
            const fullText = fullData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: fullText } }] })}\n\n`);
        } else if (isGroq || isNvidia) {
            const apiKey = isGroq ? process.env.GROQ_API_KEY : process.env.NVIDIA_API_KEY;
            if (!apiKey) throw new Error(`${isGroq ? 'GROQ' : 'NVIDIA'}_API_KEY not configured.`);
            const apiUrl = isGroq
                ? "https://api.groq.com/openai/v1/chat/completions"
                : "https://integrate.api.nvidia.com/v1/chat/completions";
            const providerModel = model.substring(model.indexOf('/') + 1);
            const response = await fetch(apiUrl, {
                method: 'POST',
                signal: upstreamTimeout(),
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ model: providerModel, messages: cleanedMessages, stream: true })
            });
            if (!response.ok) {
                providerStatusError(res, isGroq ? 'groq' : 'nvidia', response.status);
                return;
            }
            if (!response.body) {
                logProviderError(isGroq ? 'groq' : 'nvidia', 'body-null', '200 without body');
                sseError(res, 'The provider returned an empty response for this model. It may be rotating — try another model.', 'model_unavailable');
                return;
            }
            try {
                for await (const chunk of response.body) { res.write(chunk); }
            } catch (loopError) {
                const cause = (loopError && loopError.name) || 'UnknownError';
                logProviderError(isGroq ? 'groq' : 'nvidia', 'stream-loop', cause);
                sseError(res, `The provider dropped the stream mid-response (${cause}). Please try again.`, 'stream_interrupted');
                return;
            }
        } else { // OpenRouter
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured.');
            const apiUrl = "https://openrouter.ai/api/v1/chat/completions";
            const response = await fetch(apiUrl, {
                method: 'POST',
                signal: upstreamTimeout(),
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ model: useWebSearch ? `${model}:online` : model, messages: cleanedMessages, stream: true })
            });
            if (!response.ok) {
                providerStatusError(res, 'openrouter', response.status);
                return;
            }
            if (!response.body) {
                logProviderError('openrouter', 'body-null', '200 without body');
                sseError(res, 'OpenRouter returned an empty response for this model. It may be rotating — try another model.', 'model_unavailable');
                return;
            }
            try {
                for await (const chunk of response.body) { res.write(chunk); }
            } catch (loopError) {
                const cause = (loopError && loopError.name) || 'UnknownError';
                logProviderError('openrouter', 'stream-loop', cause);
                sseError(res, `OpenRouter dropped the stream mid-response (${cause}). Please try again.`, 'stream_interrupted');
                return;
            }
        }
    } catch (error) {
        if (error && (error.name === 'AbortError' || error.code === 'ABORT_ERR')) {
            logProviderError('stream', 'timeout', 'upstream exceeded time budget');
            sseError(res, 'The AI provider took too long to respond. Please try again.', 'timeout');
        } else if (error && /_API_KEY not configured/.test(error.message || '')) {
            const envVar = (error.message.match(/([A-Z_]+)_API_KEY/) || [])[1] || 'PROVIDER';
            logProviderError('config', 'missing', envVar + '_API_KEY');
            sseError(res, `AI provider not configured: ${envVar}_API_KEY is missing on the server (add it in Vercel → Settings → Environment Variables, then redeploy).`, 'config_missing');
        } else {
            // v2.0.15: carry a SAFE discriminator (error class + provider leg).
            // Never the raw message — it can contain upstream details.
            const providerLeg = (typeof isGoogle !== 'undefined' && isGoogle) ? 'google'
                : (typeof isGroq !== 'undefined' && isGroq) ? 'groq'
                : (typeof isNvidia !== 'undefined' && isNvidia) ? 'nvidia' : 'openrouter';
            const cause = (error && error.name) || 'UnknownError';
            console.error('[chat] stream error:', cause, 'leg:', providerLeg, 'model:', model, error && (error.stack || error.message));
            sseError(res, `Something went wrong while generating a response (${providerLeg}/${cause}). Check the deployment's function logs, or try again.`, 'server_error');
        }
    } finally {
        if (!res.writableEnded) {
            res.write('data: [DONE]\n\n');
            res.end();
        }
    }
}

// Google Gemini message transformer (system prompt first; user/assistant -> user/model).
// chatOptions (v1.0.3 B3/B4): webSearch -> google_search grounding tool;
// thinking -> thinkingConfig with a bounded dynamic budget (free-tier friendly).
function transformMessagesForGoogle(messages, chatOptions = {}) {
    const requestBody = { contents: [] };
    if (chatOptions.webSearch) {
        requestBody.tools = [{ google_search: {} }];
    }
    if (chatOptions.thinking) {
        requestBody.thinkingConfig = { thinkingBudget: 8192 };
    }
    let systemPromptFound = false;
    messages.forEach(msg => {
        if (msg.role === 'system' && msg.content && !systemPromptFound) {
            requestBody.systemInstruction = { role: "user", parts: [{ text: msg.content }] };
            systemPromptFound = true;
        } else if (msg.role === 'user' || msg.role === 'assistant') {
            requestBody.contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }
    });
    return requestBody;
}
