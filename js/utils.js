/**
 * ABot — utils.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 *
 * Skills-audit additions: reduced-motion-safe toast transform, draft
 * leave-guard, stream-state flag, safe-area-inset helper.
 */

import { dom } from './dom.js';
import { state } from './state.js';

// ---------------------------------------------------------------------------
// Toasts (v2.0.9): Sonner-style stack — multiple toasts, promise states,
// per-toast swipe-to-dismiss + close button. showToast() API unchanged.
// ---------------------------------------------------------------------------
const TOAST_ICONS = {
    success: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>',
    error: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.607a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>',
    loading: '<span class="toast-spinner" aria-hidden="true"></span>',
    info: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"></path></svg>',
};
const TOAST_LIMIT = 3;
const toastTimers = new WeakMap();

const setToastType = (el, type) => {
    const icon = el.querySelector('.toast-icon');
    icon.className = 'toast-icon inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg '
        + (type === 'error' ? 'text-danger' : type === 'loading' || type === 'info' ? 'text-muted' : 'text-ok');
    icon.innerHTML = TOAST_ICONS[type] || TOAST_ICONS.success;
};

const dismissToast = (el) => {
    clearTimeout(toastTimers.get(el));
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 220);
};

const scheduleAutoDismiss = (el, ms = 4000) => {
    clearTimeout(toastTimers.get(el));
    toastTimers.set(el, setTimeout(() => dismissToast(el), ms));
};

// Touch/pen only — a mouse user has the × button, and a text-selection drag
// should never fling a toast away. Follows the finger; flick or 48px dismisses.
const attachSwipe = (el) => {
    let startX = null, dx = 0, startTime = 0;
    const settle = () => {
        startX = null;
        el.style.transition = 'transform 220ms var(--ease-out)';
        el.style.transform = 'translateX(0)';
    };
    el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        startX = e.clientX; dx = 0; startTime = Date.now();
        el.style.transition = 'none';
    });
    el.addEventListener('pointermove', (e) => {
        if (startX === null) return;
        dx = e.clientX - startX;
        el.style.transform = `translateX(${Math.max(dx, -20)}px)`;
    });
    const release = (e) => {
        if (startX === null) return;
        e.preventDefault();
        const elapsed = Date.now() - startTime;
        const flick = elapsed < 240 && Math.abs(dx) > 24;
        if (dx > 48 || flick) {
            el.style.transition = 'transform 200ms var(--ease-out)';
            el.style.transform = 'translateX(130%)';
            dismissToast(el);
        } else {
            settle();
        }
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', settle);
};

export const showToast = (message, type = 'success') => {
    const el = document.createElement('div');
    el.className = 'abot-toast pointer-events-auto';
    el.setAttribute('role', 'status');
    el.innerHTML = `
        <span class="toast-icon inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg"></span>
        <div class="toast-msg ml-3 text-sm flex-1"></div>
        <button class="toast-close ml-1 p-1.5 rounded-md text-muted hover:text-ink transition-colors flex-shrink-0" aria-label="Dismiss notification">
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>`;
    el.querySelector('.toast-msg').textContent = message; // textContent — never inject
    setToastType(el, type);

    // Cap the stack: oldest toast leaves immediately when we exceed the limit.
    const stack = dom.toastStack;
    while (stack.children.length >= TOAST_LIMIT) stack.firstElementChild.remove();
    stack.appendChild(el);

    el.querySelector('.toast-close').addEventListener('click', () => dismissToast(el));
    attachSwipe(el);
    scheduleAutoDismiss(el);
    return el;
};

// Sonner-style promise states: toast.promise(p, { loading, success, error })
// Strings or functions of the result/error. Returns the original promise.
export const toast = {
    promise(p, opts = {}) {
        const el = showToast(
            typeof opts.loading === 'function' ? opts.loading() : (opts.loading || 'Working…'),
            'loading'
        );
        const finish = (msg, type) => {
            el.querySelector('.toast-msg').textContent = msg;
            setToastType(el, type);
            scheduleAutoDismiss(el, 3500);
        };
        p.then(
            (value) => finish(typeof opts.success === 'function' ? opts.success(value) : (opts.success || 'Done'), 'success'),
            (err) => finish(typeof opts.error === 'function' ? opts.error(err) : (opts.error || 'Something went wrong'), 'error')
        );
        return p;
    },
};

export const getTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// 2.2.4 (audit): human-relative message timestamps. New messages carry a `ts`
// (Date.now() at send time) — render "just now" / "5 min ago" / "2 hr ago" /
// "3 days ago", then a short date once older than a week. Legacy messages
// without a `ts` fall back to the old render-time clock so nothing vanishes.
export const formatRelativeTime = (ts) => {
    const then = Number(ts);
    if (!Number.isFinite(then)) return getTimestamp();
    const diff = Date.now() - then;
    if (diff < 45 * 1000) return 'just now';
    const rtf = new Intl.RelativeTimeFormat([], { numeric: 'auto', style: 'narrow' });
    if (diff < 60 * 60 * 1000) return rtf.format(-Math.round(diff / 60000), 'minute');
    if (diff < 24 * 60 * 60 * 1000) return rtf.format(-Math.round(diff / 3600000), 'hour');
    if (diff < 7 * 24 * 60 * 60 * 1000) return rtf.format(-Math.round(diff / 86400000), 'day');
    return new Date(then).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// --- Stream state (drives composer leave-guard; set by chat.js) ---
export const isStreaming = () => !!state.abortController;

// --- Unsent-draft leave-guard (web-design-guidelines: warn before
// navigation with unsaved changes). Cleared by chat.js on send/delete. ---
let draftHandlerInstalled = false;
let hasUnsentDraft = false;
export const setUnsentDraft = (hasDraft) => { hasUnsentDraft = !!hasDraft; };
export const installDraftLeaveGuard = () => {
    if (draftHandlerInstalled) return;
    draftHandlerInstalled = true;
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsentDraft || isStreaming()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
};

export const startVoiceRecognition = () => {
    if (!state.recognition) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech Recognition not supported in your browser.");
            return;
        }
        state.recognition = new SpeechRecognition();
        state.recognition.continuous = false;
        state.recognition.lang = 'en-US';
        state.recognition.interimResults = false;
        state.recognition.maxAlternatives = 1;

        state.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            dom.messageInput.value = dom.messageInput.value + transcript;
            dom.messageInput.dispatchEvent(new Event('input'));
        };
        state.recognition.onend = () => {
            dom.voiceBtn.classList.remove('voice-pulse', 'text-red-500');
        };
        state.recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            dom.voiceBtn.classList.remove('voice-pulse', 'text-red-500');
        };
    }
    dom.voiceBtn.classList.add('voice-pulse', 'text-red-500');
    state.recognition.start();
};

// ---------------------------------------------------------------------------
// Phase 6: text-to-speech (Web Speech API — client-side, zero API cost)
// ---------------------------------------------------------------------------
let ttsSpeaking = false;

// Reduce markdown to speakable prose: drop code blocks, keep code snippets'
// inner text out (reading code aloud is noise), unwrap links/emphasis.
export const stripForSpeech = (raw) => {
    let t = String(raw || '');
    t = t.replace(/```[\s\S]*?```/g, ' (code block) ');
    t = t.replace(/`([^`]+)`/g, '$1');
    t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, '');
    t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    t = t.replace(/^#{1,6}\s+/gm, '');
    t = t.replace(/(\*\*|__)(.*?)\1/g, '$2');
    t = t.replace(/(\*|_)(.*?)\1/g, '$2');
    t = t.replace(/^\s*[-*+]\s+/gm, '');
    t = t.replace(/\|/g, ' ');
    return t.replace(/\n{2,}/g, '. ').replace(/\s+/g, ' ').trim();
};

export const isSpeaking = () => ttsSpeaking;

export const stopSpeaking = () => {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    ttsSpeaking = false;
};

export const speakText = (raw, { onend } = {}) => {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const text = stripForSpeech(raw);
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.lang = document.documentElement.lang || 'en';
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find((v) => /en[-_]US/i.test(v.lang) && /google/i.test(v.name))
        || voices.find((v) => /^en/i.test(v.lang));
    if (preferred) utter.voice = preferred;
    ttsSpeaking = true;
    utter.onend = () => { ttsSpeaking = false; if (onend) onend(); };
    utter.onerror = () => { ttsSpeaking = false; if (onend) onend(); };
    speechSynthesis.speak(utter);
};

// ---------------------------------------------------------------------------
// HTML Sanitization & Safe Markdown Rendering (M3)
// ---------------------------------------------------------------------------
const ALLOWED_TAGS = new Set([
    'a', 'b', 'blockquote', 'br', 'code', 'dd', 'del', 'details', 'div', 'dl', 'dt',
    'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd',
    'li', 'ol', 'p', 'pre', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span',
    'strike', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot',
    'th', 'thead', 'tr', 'u', 'ul', 'var'
]);

const ALLOWED_ATTRS = new Set([
    'href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'id', 'align',
    'valign', 'width', 'height', 'colspan', 'rowspan'
]);

const FORBIDDEN_TAGS = new Set([
    'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
    'form', 'input', 'button', 'textarea', 'select', 'meta', 'link', 'base'
]);

export function sanitizeHtml(rawHtml) {
    if (!rawHtml) return '';
    if (typeof document === 'undefined') return String(rawHtml);

    const template = document.createElement('template');
    template.innerHTML = rawHtml;

    const sanitizeNode = (node) => {
        const children = Array.from(node.childNodes);
        for (const child of children) {
            if (child.nodeType === (typeof Node !== 'undefined' ? Node.ELEMENT_NODE : 1)) {
                const tagName = child.tagName.toLowerCase();
                if (FORBIDDEN_TAGS.has(tagName) || !ALLOWED_TAGS.has(tagName)) {
                    child.remove();
                    continue;
                }

                for (const attr of Array.from(child.attributes)) {
                    const attrName = attr.name.toLowerCase();
                    const attrValue = attr.value;

                    if (attrName.startsWith('on') || !ALLOWED_ATTRS.has(attrName)) {
                        child.removeAttribute(attr.name);
                        continue;
                    }

                    if (attrName === 'href' || attrName === 'src') {
                        const trimmed = attrValue.trim();
                        if (/^(javascript|data|vbscript):/i.test(trimmed)) {
                            child.removeAttribute(attr.name);
                            continue;
                        }
                    }
                }

                if (tagName === 'a' && child.hasAttribute('href')) {
                    child.setAttribute('target', '_blank');
                    child.setAttribute('rel', 'noopener noreferrer');
                }

                sanitizeNode(child);
            }
        }
    };

    sanitizeNode(template.content);
    return template.innerHTML;
}

export function renderSafeMarkdown(markdown) {
    if (!markdown) return '';
    const rawHtml = typeof window !== 'undefined' && window.marked && window.marked.parse
        ? window.marked.parse(markdown)
        : String(markdown);
    return sanitizeHtml(rawHtml);
}
