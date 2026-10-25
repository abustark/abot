/**
 * ABot — config.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */

// --- 2.6.10: the app version, single source of truth. ------------------------
// Mirrors the `### <version>` heading of the newest COMMIT-HISTORY.md entry and
// the version in the commit subject. tools/sync-version.js rewrites this line
// from the commit message via the .githooks/commit-msg hook, so it cannot drift
// when a session forgets to bump it by hand.
export const APP_VERSION = '2.7.0';

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
    // 2.6.0 free-roster refresh (OpenRouter /models, 2026-10-24)
    recursive:            { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · Recursive' },
    'xingchen-agi':       { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · XingChen' },
    'dots-studio':        { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · Dots Studio' },
    liquid:               { dot: 'bg-provider-openrouter', text: 'text-provider-openrouter', label: 'OpenRouter · LiquidAI' },
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

    // --- GOOGLE (GEMINI) — 2.2.4 (audit): refreshed to current 3.x ids
    // (2.5-pro / 2.5-flash were retired upstream). ---
    'google/gemini-3.8-flash': { name: 'Gemini 3.8 Flash', color: 'gemini' },
    'google/gemini-3.5-flash-lite': { name: 'Gemini 3.5 Flash Lite', color: 'gemini-pro' },
    // 2.6.0: ai.google.dev pricing (checked 2026-10-24) — 3.6 Flash still
    // carries a Free Tier row; 4 Argon and 3.1 Pro Preview are paid-only.
    'google/gemini-3.6-flash': { name: 'Gemini 3.6 Flash', color: 'gemini' },

    // --- OTHER GROQ (refreshed 2026-08-30 against console.groq.com/docs/models
    // + deprecations page. Groq shut down on 08/16/26: llama-3.1-8b-instant,
    // llama-3.3-70b-versatile; earlier: llama-4-scout, qwen3-32b, kimi-k2-
    // instruct, deepseek-r1-distill. Groq rotates FAST — re-check monthly.)
    // 2.2.4 (audit): qwen3.6-27b (deprecated), qwen3.8-27b (duplicate of the
    // OpenRouter :free entry below) and minimax-m2.7 (not on the free tier)
    // removed. ---
    'groq/openai/gpt-oss-20b': { name: 'GPT-OSS 20B', color: 'groq-yellow' },

    // --- NVIDIA (build.nvidia.com FREE ENDPOINT models — owner-extracted
    // 2026-08-30 from the site's Free Endpoint cards. One nvapi- key, ~40 RPM.
    // NVIDIA rotates quarterly — re-check build.nvidia.com/models.)
    // 2.0.30: every NVIDIA model carries the 'nvidia/' ROUTING prefix (like
    // Groq's 'groq/...' entries above). Without it, publisher-org ids such as
    // 'z-ai/glm-5.3' or 'openai/gpt-oss-20b' fall through the backend's
    // routing to the OpenRouter fallback (and 'google/gemma-4-31b-it' even
    // matched the Gemini rule!) — "AI provider returned an error". The backend
    // strips only the first segment, so NVIDIA receives the bare NIM id. ---
    'nvidia/meta/muse-glimmer-30b': { name: 'Muse Glimmer 30B', color: 'nvidia-green' },
    'nvidia/nvidia/nemotron-3.5-lightning-30b-a3b': { name: 'Nemotron 3.5 Lightning', color: 'nvidia-green' },
    'nvidia/moonshotai/kimi-k3': { name: 'Kimi K3', color: 'nvidia-green' },
    'nvidia/z-ai/glm-5.3-flash': { name: 'GLM 5.3 Flash', color: 'nvidia-green' },
    'nvidia/z-ai/glm-5.3': { name: 'GLM 5.3', color: 'nvidia-green' },
    'nvidia/openai/gpt-oss-20b': { name: 'GPT-OSS 20B', color: 'nvidia-green' },
    // 2.2.4 (audit): mistralai/mistral-nemotron removed — no longer on the
    // free-endpoint roster.
    'nvidia/google/gemma-4-31b-it': { name: 'Gemma 4 31B', color: 'nvidia-green' },
    'nvidia/nvidia/nemotron-3-super-120b-a12b': { name: 'Nemotron 3 Super', color: 'nvidia-green' },
    // 2.6.0 (build.nvidia.com — each carries a "Free Endpoint" badge,
    // checked 2026-10-24). Parse/embed/rerank NIMs are not chat models.
    'nvidia/deepseek-ai/deepseek-v4.1-flash': { name: 'DeepSeek V4.1 Flash', color: 'nvidia-green' },
    'nvidia/minimaxai/minimax-m3.1-flash': { name: 'MiniMax M3.1 Flash', color: 'nvidia-green' },
    'nvidia/nvidia/nemotron-3.5-bolt-e4b': { name: 'Nemotron 3.5 Bolt', color: 'nvidia-green' },
    'nvidia/nvidia/nemotron-3.5-super-vl-120b-a12b': { name: 'Nemotron 3.5 Super VL', color: 'nvidia-green' },

    // --- OPENROUTER (:free tier — refreshed 2026-08-30 against OpenRouter's
    // current roster; deepseek-chat-v3-0324:free (provider paywalled) and
    // dolphin-mistral-24b-venice (delisted) were REMOVED as deprecated.
    // The :free catalog rotates — re-check openrouter.ai/models quarterly.) ---
    // --- OWNER'S AUTHORITATIVE FREE LIST — re-checked against
    // openrouter.ai/api/v1/models on 2026-10-24 (2.6.0/2.6.1). qwen3.8-27b:free
    // and glm-5.2:free left the free tier and were dropped. 2.6.1 also dropped
    // the endpoints whose 30-minute uptime was collapsing (nemotron-3-super-120b,
    // nemotron-3-nano-omni, liquid-lfm-2.5) — free traffic is queued last, so a
    // model with a live id but a dead endpoint only produces errors.
    // nemotron-3.5-content-safety:free is a classifier (no tools), so it is
    // deliberately not offered as a chat model. ---
    'nvidia/nemotron-3-ultra-550b-a55b:free': { name: 'Nemotron 3 Ultra', color: 'openrouter-free' },
    'nvidia/nemotron-3.5-lightning:free': { name: 'Nemotron 3.5 Lightning', color: 'openrouter-free' },
    'nvidia/nemotron-3.5-super-vl:free': { name: 'Nemotron 3.5 Super VL', color: 'openrouter-free' },
    'poolside/laguna-s-2.1:free': { name: 'Poolside Laguna S 2.1', color: 'openrouter-free' },
    'poolside/laguna-xs-2.1:free': { name: 'Poolside Laguna XS 2.1', color: 'openrouter-free' },
    'google/gemma-4-26b-a4b-it:free': { name: 'Gemma 4 26B A4B', color: 'openrouter-free' }, // MoE variant
    'google/gemma-4-31b-it:free': { name: 'Gemma 4 31B', color: 'openrouter-free' },
    'thinkingmachines/inkling:free': { name: 'Thinking Machines Inkling', color: 'openrouter-free' },
    'thinkingmachines/inkling-small:free': { name: 'Thinking Machines Inkling Small', color: 'openrouter-free' },
    'recursive/flint-v1.0:free': { name: 'Recursive Flint', color: 'openrouter-free' },
    'xingchen-agi/xing4.0-29b-a4b:free': { name: 'XingChen Xing 4.0', color: 'openrouter-free' },
    'dots-studio/dots-3-note-preview:free': { name: 'Dots3 Note Preview', color: 'openrouter-free' },
    'cohere/north-mini-code:free': { name: 'Cohere North Mini Code', color: 'openrouter-free' },
    'openrouter/free': { name: 'OpenRouter Auto (Free)', color: 'openrouter-free' }, // auto-routes to the best available free model
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
const THINKING_MODELS = new Set(['google/gemini-3.8-flash']); // 2.2.4 (audit): id refreshed

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
