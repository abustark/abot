const express = require('express');
require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const chatSecurity = require('./lib/chat-security.js');

const { LIMITS, validateChatRequest, MemoryRateLimiter, identityKey, clientIp, upstreamTimeout, sseError, logProviderError } = chatSecurity;

// Initialize Firebase Admin SDK
let serviceAccount;
const keyFilePath = path.join(__dirname, 'service-account-key.json');

// Try to load from JSON file first (easier for local dev)
if (fs.existsSync(keyFilePath)) {
    try {
        serviceAccount = require(keyFilePath);
        console.log("Firebase Admin SDK: Using service-account-key.json file.");
    } catch (error) {
        console.error("Error reading service-account-key.json:", error);
        process.exit(1);
    }
}
// Fall back to environment variable
else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        console.log("Firebase Admin SDK: Using FIREBASE_SERVICE_ACCOUNT_JSON env variable.");
    } catch (error) {
        console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:", error);
        process.exit(1);
    }
} else {
    console.error("CRITICAL ERROR: No Firebase credentials found!");
    console.error("Either create a 'service-account-key.json' file or set FIREBASE_SERVICE_ACCOUNT_JSON in .env");
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
console.log("Firebase Admin SDK initialized successfully.");

const app = express();
const port = process.env.PORT || 3000;

// Security: security headers (CSP will be tightened in Phase 2 once inline JS is removed)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                // hash-pinned pre-render blocks: theme flicker guard + SW registration
                "'sha256-2ZlTh5XhLKMq+T7gRcJnqOEzBgpEkLeVTox22opwovI='",
                "'sha256-fq//prnuaShEK0q5xr96arIXZPwXofVQB6ZwTWEYAs4='",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://www.gstatic.com",
                "https://accounts.google.com"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
                "https://cdnjs.cloudflare.com"
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://i.pravatar.cc", "https://*.googleusercontent.com"],
            connectSrc: [
                "'self'",
                "https://generativelanguage.googleapis.com",
                "https://api.groq.com",
                "https://integrate.api.nvidia.com",
                "https://openrouter.ai",
                "https://accounts.google.com",
                "https://www.googleapis.com",
                "https://firestore.googleapis.com",
                "https://identitytoolkit.googleapis.com",
                "https://securetoken.googleapis.com",
                "wss://firestore.googleapis.com",
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net",
                "https://fonts.googleapis.com",
                "https://fonts.gstatic.com",
                "https://www.gstatic.com"
            ],
            frameSrc: ["https://accounts.google.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false, // Required for some CDN resources
}));

// Security: rate limiting
// General: 100 requests / 15 min per IP — chat: enforced per-identity below (shared lib)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(generalLimiter);

// NOTE: no cors() — the app is same-origin (frontend and API are served together)

app.use(express.json({ limit: '256kb' }));

// --- Static serving: explicit allowlist ONLY ---
// (Previously express.static('.') exposed server.js, package.json, .git/ ...)
const sendRootFile = (filename) => (req, res) => res.sendFile(path.join(__dirname, filename));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/favicon.png', sendRootFile('favicon.png'));
app.get('/logo.png', sendRootFile('logo.png'));
app.get('/service-worker.js', (req, res) => {
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(path.join(__dirname, 'service-worker.js'));
});
app.use('/dist', express.static(path.join(__dirname, 'dist'), {
    dotfiles: 'ignore',
    index: false,
    maxAge: '1h'
}));
app.use('/js', express.static(path.join(__dirname, 'js'), {
    dotfiles: 'ignore',
    index: false,
    maxAge: '1h'
}));
// Everything else under the repo root is NOT served (404 by default).

// Middleware to verify Firebase token (Authorization header ONLY — query params rejected)
const checkAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.slice('Bearer '.length).trim();
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            req.user = decodedToken;
            return next();
        } catch (error) {
            console.error('Token verification failed');
            return res.status(403).json({ error: 'Unauthorized: Invalid token.' });
        }
    }
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
};

// Local-dev config endpoint (Firebase web config is public by design; production
// keeps it inline in index.html). Rate-limited by generalLimiter.
app.get('/api/firebase-config', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        googleClientId: process.env.GOOGLE_CLIENT_ID
    });
});

// Shared per-identity limiter (uid, else hashed IP) — mirrors api/chat.js
const chatMemoryLimiter = new MemoryRateLimiter();

app.post('/api/chat', checkAuth, async (req, res) => {
    // Rate limit per identity
    const rl = chatMemoryLimiter.check(identityKey(req.user && req.user.uid, clientIp(req)));
    if (!rl.allowed) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({ error: 'Rate limit exceeded. Please wait before sending more messages.' });
    }

    // Shared validation & limits
    const v = validateChatRequest(req.body);
    if (!v.ok) {
        return res.status(v.code).json({ error: v.message });
    }
    const { model, cleanedMessages } = v;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Connection', 'keep-alive');
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
            const response = await fetch(apiUrl, {
                method: 'POST',
                signal: upstreamTimeout(),
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey // key in header, never in URL
                },
                body: JSON.stringify(transformMessagesForGoogle(cleanedMessages))
            });

            if (!response.ok) {
                logProviderError('google', response.status, await response.text());
                throw new Error('The AI provider returned an error. Please try again.');
            }

            const fullData = await response.json();
            const fullText = fullData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const sseData = { choices: [{ delta: { content: fullText } }] };
            res.write(`data: ${JSON.stringify(sseData)}\n\n`);

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

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(decoder.decode(value));
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
                body: JSON.stringify({ model, messages: cleanedMessages, stream: true })
            });

            if (!response.ok) {
                logProviderError('openrouter', response.status, await response.text());
                throw new Error('The AI provider returned an error. Please try again.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(decoder.decode(value));
            }
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
});

/**
 * Transforms the generic message format into the Google Gemini format.
 * @param {Array<Object>} messages - cleaned messages array.
 */
function transformMessagesForGoogle(messages) {
    const requestBody = { contents: [] };
    let systemPromptFound = false;

    messages.forEach(msg => {
        if (msg.role === 'system' && msg.content && !systemPromptFound) {
            requestBody.systemInstruction = {
                role: "user",
                parts: [{ text: msg.content }]
            };
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

// Malformed JSON body -> clean 400 (never a stack trace)
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body too large' });
    }
    console.error('[server] unhandled error');
    return res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
