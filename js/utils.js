/**
 * ABot — utils.js
 * Extracted from index.html inline module (Phase 2 de-monolithization).
 * Logic frozen; only imports/exports/state.* renames were applied.
 * Verify with: node tools/verify-parity.js
 */

import { dom } from './dom.js';
import { state } from './state.js';
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
    dom.toastNotification.style.transform = 'translateX(0)';

    setTimeout(() => {
        dom.toastNotification.style.transform = 'translateX(150%)';
    }, 4000);
};

export const getTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
