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

// Single owner of "take the toast away" — the auto-dismiss timer, the × button
// and the swipe gesture all route through here so they cannot fight (the old
// code cleared the timer in one place and not the other).
const dismissToast = () => {
    clearTimeout(state.toastTimeout);
    dom.toastNotification.style.transition = 'transform 220ms var(--ease-out)';
    dom.toastNotification.style.transform = 'translateX(150%)';
};

export const showToast = (message, type = 'success') => {
    dom.toastMessage.textContent = message;

    const successClasses = ['text-ok'];
    const errorClasses = ['text-danger'];

    dom.toastIcon.classList.remove(...successClasses, ...errorClasses);

    if (type === 'success') {
        dom.toastIcon.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>`;
        dom.toastIcon.classList.add(...successClasses);
    } else { // error
        dom.toastIcon.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.607a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>`;
        dom.toastIcon.classList.add(...errorClasses);
    }

    dom.toastNotification.classList.remove('hidden');
    dom.toastNotification.style.transition = 'transform 0.4s var(--ease-out)';
    dom.toastNotification.style.transform = 'translateX(0)';

    clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(dismissToast, 4000);

    // One-time wiring: explicit dismiss button (a11y) + swipe-to-dismiss.
    if (dom.toastCloseBtn && !dom.toastCloseBtn.dataset.wired) {
        dom.toastCloseBtn.dataset.wired = '1';
        dom.toastCloseBtn.addEventListener('click', dismissToast);
    }
    // B7 (v1.0.6): the toast now follows the finger instead of waiting for a
    // 48px jump on release, and a quick flick dismisses it even when short.
    // Touch/pen only — a mouse user has the × button, and a text selection
    // drag should never fling the toast away.
    if (!dom.toastNotification.dataset.wired) {
        dom.toastNotification.dataset.wired = '1';
        const toast = dom.toastNotification;
        let startX = null, dx = 0, startTime = 0;
        const settle = () => {
            startX = null;
            toast.style.transition = 'transform 220ms var(--ease-out)';
            toast.style.transform = 'translateX(0)';
        };
        toast.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') return;
            startX = e.clientX; dx = 0; startTime = performance.now();
            toast.style.transition = 'none'; // follow the finger 1:1
            try { toast.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
        });
        toast.addEventListener('pointermove', (e) => {
            if (startX === null) return;
            dx = Math.max(0, e.clientX - startX); // right = slide-out direction
            toast.style.transform = `translateX(${dx}px)`;
        });
        const endSwipe = () => {
            if (startX === null) return;
            const velocity = dx / Math.max(performance.now() - startTime, 1); // px/ms
            const dismiss = dx > 48 || velocity > 0.5;
            startX = null;
            if (dismiss) dismissToast();
            else settle();
        };
        toast.addEventListener('pointerup', endSwipe);
        toast.addEventListener('pointercancel', endSwipe);
    }
};

export const getTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
