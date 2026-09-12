/**
 * ABot — config.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */
export const COLOR_MAP = {
    // Google
    gemini: { name: 'sky-500', isLight: false },
    'gemini-pro': { name: 'blue-500', isLight: false },
    // DeepSeek
    'deepseek-v3': { name: 'blue-700', isLight: false },
    'deepseek-r1': { name: 'teal-500', isLight: false },
    // Qwen (Alibaba Cloud)
    'qwen-32b': { name: 'purple-500', isLight: false },
    'qwen-235b': { name: 'violet-500', isLight: false },
    // Llama (Meta)
    'llama-blue': { name: 'indigo-600', isLight: false },
    // Mixtral (Mistral AI)
    'mistral-orange': { name: 'orange-500', isLight: false },
    // Claude (Anthropic)
    'claude-mauve': { name: 'rose-800', isLight: false },
    // Groq - THIS IS THE KEY CHANGE
    'groq-yellow': { name: 'amber-400', isLight: true }, // Amber is a light background
    // NVIDIA
    'nvidia-green': { name: 'emerald-500', isLight: false },
    // Default
    'indigo-600': { name: 'indigo-600', isLight: false }
};

export const generateColorClasses = (colorName) => {
    const config = COLOR_MAP[colorName] || { name: 'indigo-600', isLight: false };
    const color = config.name;
    // Phase 3: primary actions are always coral; the model identity lives in
    // small accents (selector dot), not button colors. Bubbles are warm card.
    return {
                        bg: 'bg-coral',
                        hoverBg: 'hover:bg-coral-active',
                        text: 'text-coral',
                        border: 'border-coral',
                        userBubbleBg: 'bg-card',
        userBubbleTextColorClass: 'text-ink',
        userBubbleTimestampColorClass: 'text-muted'
    };
};

// Initialize the Firestore database

// --- Provider identity colors (owner spec: OpenRouter=amber, Groq=violet,
// Gemini=blue, NVIDIA=green; OpenRouter-hosted models inherit amber).
// Skills-audit Phase 2: raw Tailwind palette classes replaced with semantic
// tokens (--c-provider-*) so hues stay warm-harmonized and dark-mode aware.
export const PROVIDER_COLORS = {
    google:               { dot: 'bg-provider-google',     text: 'text-provider-google',     label: 'Google Gemini' },
    groq:                 { dot: 'bg-provider-groq',       text: 'text-provider-groq',       label: 'Groq' },
    nvidia:               { dot: 'bg-provider-nvidia',     text: 'text-provider-nvidia',     label: 'NVIDIA' },
    openrouter:           { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter' },
    deepseek:             { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · DeepSeek' },
    qwen:                 { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · Qwen' },
    'z-ai':               { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · GLM' },
    cognitivecomputations:{ dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · Venice' },
};

export const getProviderColor = (model) => {
    const provider = String(model || '').split('/')[0].toLowerCase();
    return PROVIDER_COLORS[provider] || { dot: 'bg-coral', text: 'text-coral', label: 'ABot' };
};

export const MODEL_CONFIG = {
    // --- NEW DEFAULT ---
    'groq/openai/gpt-oss-120b': { name: 'GPT-oss', color: 'groq-yellow' },

    // --- GOOGLE (GEMINI) ---
    'google/gemini-2.5-pro': { name: 'Gemini 2.5 Pro', color: 'gemini' },
    'google/gemini-2.5-flash': { name: 'Gemini 2.5 Flash', color: 'gemini-pro' },

    // --- OTHER GROQ ---
    'groq/deepseek-r1-distill-llama-70b': { name: 'DeepSeek R1 70B', color: 'groq-yellow' },
    'groq/llama-3.1-8b-instant': { name: 'Llama 3.1', color: 'groq-yellow' },
    'groq/meta-llama/llama-4-maverick-17b-128e-instruct': { name: 'Llama 4 Maverick', color: 'groq-yellow' },
    'groq/meta-llama/llama-4-scout-17b-16e-instruct': { name: 'Llama 4 Scout', color: 'groq-yellow' },
    'groq/moonshotai/kimi-k2-instruct': { name: 'Kimi K2', color: 'groq-yellow' },

    // --- NVIDIA ---
    'nvidia/openai/gpt-oss-20b': { name: 'GPT-oss 20b', color: 'nvidia-green' },
    'nvidia/nvidia/nvidia-nemotron-nano-9b-v2': { name: 'Nvidia Nim', color: 'nvidia-green' },
    'nvidia/mistralai/mistral-nemotron': { name: 'Mistral', color: 'nvidia-green' },
    'nvidia/deepseek-ai/deepseek-r1-0528': { name: 'DeepSeek R1', color: 'nvidia-green' },
    'nvidia/qwen/qwen2.5-coder-32b-instruct': { name: 'Qwen 2.5 Coder', color: 'nvidia-green' },

    // --- OPENROUTER ---
    'deepseek/deepseek-chat-v3-0324:free': { name: 'DeepSeek V3', color: 'deepseek-v3' },
    'qwen/qwen3-coder:free': { name: 'Qwen 3 Coder', color: 'qwen-32b' },
    'z-ai/glm-4.5-air:free': { name: 'GLM 4.5', color: 'llama-blue' },
    'cognitivecomputations/dolphin-mistral-24b-venice-edition:free': { name: 'Venice AI', color: 'mistral-orange' },
};

// =================================================================================
// STATE MANAGEMENT
// =================================================================================

export const GUEST_MESSAGE_LIMIT = 5;

export const SYSTEM_PROMPTS = [
    { title: "Standard Assistant", prompt: "You are a helpful AI assistant." },
    { title: "Code Helper", prompt: "You are an expert programmer. Provide clear, concise, and accurate code examples. Use markdown for all code blocks and explain your reasoning." },
    { title: "Sarcastic Pirate", prompt: "You are a sarcastic pirate captain. Respond with pirate slang and a witty, cynical tone. Refer to the user as 'matey'." },
    { title: "Creative Writer", prompt: "You are an imaginative storyteller. Help the user brainstorm ideas, write stories, and develop characters with creative and descriptive language." },
    { title: "Email Assistant", prompt: "You are a professional communication assistant. Your task is to draft clear, concise, and effective emails. Adapt your tone based on the user's request (e.g., formal, friendly, assertive)." },
    { title: "Technical Writer", prompt: "You are a technical writer whose goal is to create clear, accurate, and easy-to-follow documentation. Structure your responses logically with headings, lists, and code blocks where appropriate." },
    { title: "ELI5 Explainer", prompt: "You are an expert at simplifying complex topics. Explain concepts as if you were talking to a curious five-year-old, using simple language and relatable analogies. Avoid all technical jargon." },
    { title: "Brainstorm Partner", prompt: "You are a creative brainstorming partner. Your goal is to help the user generate ideas. Ask clarifying questions, build upon their ideas with 'Yes, and...' statements, and offer diverse perspectives." },
    { title: "Game Master", prompt: "You are the Game Master for a text-based fantasy role-playing game. Describe the world, the challenges, and the outcomes of the user's actions. Be descriptive and engaging. Begin by asking the user to create their character." }
];
