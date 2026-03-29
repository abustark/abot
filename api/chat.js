import admin from 'firebase-admin';
import fetch from 'node-fetch'; // Vercel often requires this to be explicit

// --- Firebase Admin SDK Initialization ---
// This part runs only once when the function starts up
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

// --- Main Serverless Function Handler ---
export default async function handler(req, res) {
    // We only want to handle POST requests for the chat API
    if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method Not Allowed' });
    }

    // --- Middleware Logic (checkAuth) ---
    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    }
    if (!idToken) {
        return res.status(401).send({ error: 'Unauthorized: No token provided.' });
    }
    try {
        await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        console.error('Error while verifying Firebase ID token:', error);
        return res.status(403).send({ error: 'Unauthorized: Invalid token.' });
    }
    // --- End of Auth Logic ---

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

    const isGoogle = model.startsWith('google/');
    const isGroq = model.startsWith('groq/');
    const isNvidia = model.startsWith('nvidia/');

    try {
        if (isGoogle) {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error('GEMINI_API_KEY not configured.');
            const googleModelName = model.split('/')[1];
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${googleModelName}:generateContent?key=${apiKey}`;
            const requestBody = transformMessagesForGoogle(messages);
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) { const e = await response.text(); throw new Error(`API Error: ${response.status} - ${e}`); }
            const fullData = await response.json();
            const fullText = fullData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: fullText } }] })}\n\n`);
        } else if (isGroq) {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) throw new Error('GROQ_API_KEY not configured.');
            const apiUrl = "https://api.groq.com/openai/v1/chat/completions";
            const groqModelName = model.substring(model.indexOf('/') + 1);
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: groqModelName, messages, stream: true })
            });
            if (!response.ok) { const e = await response.text(); throw new Error(`API Error: ${response.status} - ${e}`); }
            for await (const chunk of response.body) { res.write(chunk); }
        } else if (isNvidia) {
            const apiKey = process.env.NVIDIA_API_KEY;
            if (!apiKey) throw new Error('NVIDIA_API_KEY not configured.');
            const apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
            const nvidiaModelName = model.substring(model.indexOf('/') + 1);
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: nvidiaModelName, messages, stream: true })
            });
            if (!response.ok) { const e = await response.text(); throw new Error(`API Error: ${response.status} - ${e}`); }
            for await (const chunk of response.body) { res.write(chunk); }
        } else { // Default to OpenRouter
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured.');
            const apiUrl = "https://openrouter.ai/api/v1/chat/completions";
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages, stream: true })
            });
            if (!response.ok) { const e = await response.text(); throw new Error(`API Error: ${response.status} - ${e}`); }
            for await (const chunk of response.body) { res.write(chunk); }
        }
    } catch (error) {
        console.error('Serverless function error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
    } finally {
        res.write('data: [DONE]\n\n');
        res.end();
    }
}

// Helper function remains the same
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