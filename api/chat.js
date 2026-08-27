import admin from 'firebase-admin';
import chatSecurity from '../lib/chat-security.js';

const { LIMITS, validateChatRequest, MemoryRateLimiter, identityKey, clientIp, upstreamTimeout, sseError, logProviderError } = chatSecurity;

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

// Tier-1 rate limiting (in-memory, per warm instance — see IMPLEMENTATION_PLAN.md)
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
        uid = decodedToken.uid;
    } catch (error) {
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
    const { model, cleanedMessages } = v;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const isGoogle = model.startsWith('google/');
    const isGroq = model.startsWith('groq/');
    const isNvidia = model.startsWith('nvidia/');

    try {
        if (isGoogle) {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error('GEMINI_API_KEY not configured.');
            const googleModelName = model.split('/')[1];
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(googleModelName)}:generateContent`;
            const requestBody = transformMessagesForGoogle(cleanedMessages);
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
                logProviderError('google', response.status, await response.text());
                throw new Error('The AI provider returned an error. Please try again.');
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
                logProviderError(isGroq ? 'groq' : 'nvidia', response.status, await response.text());
                throw new Error('The AI provider returned an error. Please try again.');
            }
            for await (const chunk of response.body) { res.write(chunk); }
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
                body: JSON.stringify({ model, messages: cleanedMessages, stream: true })
            });
            if (!response.ok) {
                logProviderError('openrouter', response.status, await response.text());
                throw new Error('The AI provider returned an error. Please try again.');
            }
            for await (const chunk of response.body) { res.write(chunk); }
        }
    } catch (error) {
        if (error && (error.name === 'AbortError' || error.code === 'ABORT_ERR')) {
            logProviderError('stream', 'timeout', 'upstream exceeded time budget');
            sseError(res, 'The AI provider took too long to respond. Please try again.');
        } else {
            console.error('[chat] stream error');
            sseError(res, 'Something went wrong while generating a response. Please try again.');
        }
    } finally {
        if (!res.writableEnded) {
            res.write('data: [DONE]\n\n');
            res.end();
        }
    }
}

// Google Gemini message transformer (system prompt first; user/assistant -> user/model)
function transformMessagesForGoogle(messages) {
    const requestBody = { contents: [] };
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
