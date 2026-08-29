const express = require('express');
const cors = require('cors');
require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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
const port = 3000;

// Security: Add helmet for security headers
const helmet = require('helmet');
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'", // Required for inline scripts
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

// Security: Rate limiting
const rateLimit = require('express-rate-limit');

// General rate limit: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter limit for chat API: 30 requests per 15 minutes
const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Rate limit exceeded for chat API. Please wait before sending more messages.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(generalLimiter);
app.use(express.static('.'));
app.use(cors());
app.use(express.json());

// Middleware to verify Firebase token
const checkAuth = async (req, res, next) => {
    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else if (req.query.token) {
        idToken = req.query.token;
    }

    if (idToken) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            req.user = decodedToken;
            return next();
        } catch (error) {
            console.error('Error while verifying Firebase ID token:', error);
            return res.status(403).send({ error: 'Unauthorized: Invalid token.' });
        }
    } else {
        return res.status(401).send({ error: 'Unauthorized: No token provided.' });
    }
};

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

app.post('/api/chat', chatLimiter, checkAuth, async (req, res) => {
    const { model, messages } = req.body;

    // Security: Input validation
    const ALLOWED_PROVIDERS = ['google/', 'groq/', 'nvidia/', 'deepseek/', 'qwen/', 'z-ai/', 'cognitivecomputations/'];

    if (!model || typeof model !== 'string') {
        return res.status(400).json({ error: 'Invalid model parameter' });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Invalid messages parameter' });
    }

    // Validate model starts with an allowed provider
    const isValidProvider = ALLOWED_PROVIDERS.some(provider => model.startsWith(provider));
    if (!isValidProvider) {
        return res.status(400).json({ error: 'Invalid model provider' });
    }

    // Validate each message has required fields
    for (const msg of messages) {
        if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
            return res.status(400).json({ error: 'Invalid message role' });
        }
        if (typeof msg.content !== 'string') {
            return res.status(400).json({ error: 'Invalid message content' });
        }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Create a "cleaned" version of the messages array for standard APIs
    const cleanedMessages = messages.map(({ role, content }) => ({ role, content }));

    const isGoogle = model.startsWith('google/');
    const isGroq = model.startsWith('groq/');
    const isNvidia = model.startsWith('nvidia/');

    try {
        if (isGoogle) {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error('GEMINI_API_KEY not configured.');

            const googleModelName = model.split('/')[1];
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${googleModelName}:generateContent?key=${apiKey}`;
            // Google's transformer function uses the original 'messages' array
            const requestBody = transformMessagesForGoogle(messages);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData}`);
            }

            const fullData = await response.json();
            const fullText = fullData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const sseData = { choices: [{ delta: { content: fullText } }] };
            res.write(`data: ${JSON.stringify(sseData)}\n\n`);

        } else if (isGroq) {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) throw new Error('GROQ_API_KEY not configured.');

            const apiUrl = "https://api.groq.com/openai/v1/chat/completions";
            const groqModelName = model.substring(model.indexOf('/') + 1);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                // Use the cleaned messages array
                body: JSON.stringify({ model: groqModelName, messages: cleanedMessages, stream: true })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(decoder.decode(value));
            }

        } else if (isNvidia) {
            const apiKey = process.env.NVIDIA_API_KEY;
            if (!apiKey) throw new Error('NVIDIA_API_KEY not configured.');

            const apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
            const nvidiaModelName = model.substring(model.indexOf('/') + 1);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                // Use the cleaned messages array
                body: JSON.stringify({ model: nvidiaModelName, messages: cleanedMessages, stream: true })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(decoder.decode(value));
            }

        } else { // Default to OpenRouter
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured.');

            const apiUrl = "https://openrouter.ai/api/v1/chat/completions";
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                // Use the cleaned messages array
                body: JSON.stringify({ model, messages: cleanedMessages, stream: true })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData}`);
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
        console.error('Server stream error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
    } finally {
        // Always send a [DONE] message for the frontend to correctly finish.
        res.write('data: [DONE]\n\n');
        res.end();
    }
});

/**
 * Transforms the generic message format into the specific format
 * required by the Google Gemini API, building a valid request body.
 * @param {Array<Object>} messages - The array of message objects.
 * @returns {Object} - The complete, final request body for the Google API.
 */
function transformMessagesForGoogle(messages) {
    const requestBody = { contents: [] };
    let systemPromptFound = false;

    // The Gemini API requires the system prompt to be the very first part of the request.
    // It also doesn't like an empty user message right after a system prompt.
    messages.forEach(msg => {
        if (msg.role === 'system' && msg.content && !systemPromptFound) {
            // Add the system prompt in the correct format
            requestBody.systemInstruction = {
                role: "user", // The role for system instructions must be 'user'
                parts: [{ text: msg.content }]
            };
            systemPromptFound = true;
        } else if (msg.role === 'user' || msg.role === 'assistant') {
            // Add user and assistant messages to the main contents
            requestBody.contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }
    });

    return requestBody;
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});