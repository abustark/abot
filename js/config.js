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

export const generateColorClasses = (_colorName) => {
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
    // 2026 :free roster orgs (publisher prefix on OpenRouter)
    openai:               { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · OpenAI' },
    inclusionai:          { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · inclusionAI' },
    thinkingmachines:     { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · Thinking Machines' },
    'meta-llama':         { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · Meta' },
    poolside:             { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · Poolside' },
    cohere:               { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · Cohere' },
    nousresearch:         { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · Nous' },
};

export const getProviderColor = (model) => {
    const m = String(model || '');
    // ':free' is OpenRouter's signature — identity beats the org prefix
    // (openai/gemma/nvidia on OpenRouter still show OpenRouter yellow).
    if (m.endsWith(':free')) return PROVIDER_COLORS.openrouter;
    const provider = m.split('/')[0].toLowerCase();
    return PROVIDER_COLORS[provider] || { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter' };
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

    // --- OPENROUTER (:free tier — refreshed 2026-08-30 against OpenRouter's
    // current roster; deepseek-chat-v3-0324:free (provider paywalled) and
    // dolphin-mistral-24b-venice (delisted) were REMOVED as deprecated.
    // The :free catalog rotates — re-check openrouter.ai/models quarterly.) ---
    'qwen/qwen3-coder:free': { name: 'Qwen 3 Coder', color: 'openrouter-free' },
    'z-ai/glm-4.5-air:free': { name: 'GLM 4.5 Air', color: 'openrouter-free' },
    'openai/gpt-oss-120b:free': { name: 'GPT-OSS 120B', color: 'openrouter-free' },
    'openai/gpt-oss-20b:free': { name: 'GPT-OSS 20B', color: 'openrouter-free' },
    'meta-llama/llama-3.3-70b-instruct:free': { name: 'Llama 3.3 70B', color: 'openrouter-free' },
    'google/gemma-4-31b-it:free': { name: 'Gemma 4 31B', color: 'openrouter-free' },
    'nvidia/nemotron-3-ultra-550b-a55b:free': { name: 'Nemotron 3 Ultra', color: 'openrouter-free' },
    // Live-site refresh 2026-08-30 (openrouter.ai/models?q=free+):
    'poolside/laguna-s-2.1:free': { name: 'Poolside Laguna S 2.1', color: 'openrouter-free' },
    'thinkingmachines/inkling:free': { name: 'Inkling 975B', color: 'openrouter-free' },
    'nvidia/nemotron-3.5-lightning:free': { name: 'Nemotron 3.5 Lightning', color: 'openrouter-free' },
    'inclusionai/ling-3.0-flash-vl:free': { name: 'Ling 3.0 Flash VL', color: 'openrouter-free' },
    // Owner-requested adds (verified on model pages 2026-08-30):
    'qwen/qwen3.8-27b:free': { name: 'Qwen 3.8 27B', color: 'openrouter-free' }, // 262K ctx, vision-language, flexible thinking
    'z-ai/glm-5.2:free': { name: 'GLM 5.2', color: 'openrouter-free' }, // NOTE: free variant is 33K ctx (1M is paid)
};

// =================================================================================
// STATE MANAGEMENT
// =================================================================================

export const GUEST_MESSAGE_LIMIT = 5;

// Per-model capability gates for the composer chips (v1.0.3).
//  - webSearch: OpenRouter-routed models support the `:online` plugin and
//    Gemini supports google_search grounding; Groq/NVIDIA direct APIs offer
//    neither, so the chip is disabled there.
//  - thinking: only models with a real on/off thinking control. DeepSeek R1
//    variants always reason (no toggle to offer) — chip stays disabled with
//    an explanatory tooltip.
const THINKING_MODELS = new Set(['google/gemini-2.5-pro']);

export const modelCapabilities = (model) => {
    const m = String(model || '');
    return {
        webSearch: !m.startsWith('groq/') && !m.startsWith('nvidia/') && !m.endsWith(':free'),
        thinking: THINKING_MODELS.has(m),
        alwaysThinks: /deepseek-r1/.test(m),
    };
};

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
