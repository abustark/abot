/**
 * ABot Utility Functions Module
 * Contains security helpers, toast notifications, and voice recognition
 * 
 * NOTE: This is a reference module extracted from index.html inline code.
 * The app currently still uses inline JS. This file is for future refactoring.
 */

// Security: Escape HTML entities to prevent XSS
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Security: Sanitize HTML output (requires DOMPurify)
export function sanitizeHtml(html) {
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    }
    return html;
}

// Get formatted timestamp
export function getTimestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Toast notification
export function showToast(dom, message, type = 'success') {
    if (!dom.toastNotification) return;

    const icons = {
        success: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>',
        error: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>'
    };

    const colors = {
        success: 'bg-green-100 dark:bg-green-800 text-green-500 dark:text-green-200',
        error: 'bg-red-100 dark:bg-red-800 text-red-500 dark:text-red-200'
    };

    dom.toastIcon.innerHTML = icons[type] || icons.success;
    dom.toastIcon.className = `inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg ${colors[type] || colors.success}`;
    dom.toastMessage.textContent = message;
    dom.toastNotification.classList.remove('hidden');
    dom.toastNotification.style.transform = 'translateX(0)';

    setTimeout(() => {
        dom.toastNotification.style.transform = 'translateX(150%)';
    }, 4000);
}

// Voice recognition setup
export function initVoiceRecognition(dom, onResult) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        if (dom.voiceBtn) dom.voiceBtn.style.display = 'none';
        return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
    };

    recognition.onend = () => {
        if (dom.voiceBtn) {
            dom.voiceBtn.classList.remove('animate-pulse', 'text-red-500');
        }
    };

    recognition.onerror = () => {
        if (dom.voiceBtn) {
            dom.voiceBtn.classList.remove('animate-pulse', 'text-red-500');
        }
    };

    return recognition;
}
