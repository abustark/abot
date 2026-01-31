/**
 * ABot Configuration Module
 * Contains color mappings, model configurations, and constants
 * 
 * NOTE: This is a reference module extracted from index.html inline code.
 * The app currently still uses inline JS. This file is for future refactoring.
 */

export const COLOR_MAP = {
    // Google
    gemini: { name: 'sky-500', isLight: false },
    'gemini-pro': { name: 'blue-500', isLight: false },
    'gemini-flash': { name: 'blue-700', isLight: false },

    // Groq/Meta
    llama: { name: 'teal-500', isLight: false },
    'llama-4': { name: 'purple-500', isLight: false },
    'llama-70b': { name: 'violet-500', isLight: false },
    mixtral: { name: 'indigo-600', isLight: false },

    // NVIDIA
    nvidia: { name: 'green-500', isLight: false },

    // OpenRouter
    deepseek: { name: 'orange-500', isLight: false },
    mistral: { name: 'rose-800', isLight: false },
    qwen: { name: 'amber-400', isLight: true },
    phi: { name: 'emerald-500', isLight: false }
};

export const MODEL_CONFIG = {
    // Google Gemini
    "google/gemini-2.0-flash": { name: "Gemini 2.0 Flash", color: "gemini-flash", provider: "google" },
    "google/gemini-2.5-pro-preview": { name: "Gemini 2.5 Pro Preview", color: "gemini-pro", provider: "google" },
    "google/gemini-2.5-flash-preview": { name: "Gemini 2.5 Flash Preview", color: "gemini-flash", provider: "google" },

    // Groq
    "groq/llama-3.3-70b-versatile": { name: "Llama 3.3 70B", color: "llama-70b", provider: "groq" },
    "groq/meta-llama/llama-4-scout-17b-16e-instruct": { name: "Llama 4 Scout", color: "llama-4", provider: "groq" },
    "groq/meta-llama/llama-4-maverick-17b-128e-instruct": { name: "Llama 4 Maverick", color: "llama-4", provider: "groq" },
    "groq/mixtral-8x7b-32768": { name: "Mixtral 8x7B", color: "mixtral", provider: "groq" },

    // NVIDIA
    "nvidia/meta/llama-3.1-70b-instruct": { name: "Llama 3.1 70B (NVIDIA)", color: "nvidia", provider: "nvidia" },

    // OpenRouter
    "openrouter/deepseek/deepseek-r1:free": { name: "DeepSeek R1", color: "deepseek", provider: "openrouter" },
    "openrouter/mistralai/mistral-small-3.1-24b-instruct:free": { name: "Mistral Small 3.1", color: "mistral", provider: "openrouter" },
    "openrouter/qwen/qwen3-30b-a3b:free": { name: "Qwen 3 30B", color: "qwen", provider: "openrouter" },
    "openrouter/microsoft/phi-4-reasoning-plus:free": { name: "Phi-4 Reasoning+", color: "phi", provider: "openrouter" }
};

export const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";
export const GUEST_MESSAGE_LIMIT = 10;

export function generateColorClasses(colorKey) {
    const colorConfig = COLOR_MAP[colorKey] || { name: 'indigo-600', isLight: false };
    const colorName = colorConfig.name;
    const isLight = colorConfig.isLight;

    return {
        bg: `bg-${colorName}`,
        hoverBg: `hover:bg-${colorName}/90`,
        text: `text-${colorName}`,
        border: `border-${colorName}`,
        userBubbleBg: `bg-${colorName}`,
        userBubbleTextColorClass: isLight ? 'text-gray-900' : 'text-white',
        userBubbleTimestampColorClass: isLight ? 'text-gray-700' : 'text-white/80'
    };
}

export async function fetchFirebaseConfig() {
    const response = await fetch('/api/firebase-config');
    if (!response.ok) throw new Error('Failed to load config');
    return response.json();
}
