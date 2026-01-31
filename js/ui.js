/**
 * ABot UI Module
 * Handles theme, sidebar, modals, and general UI interactions
 * 
 * NOTE: This is a reference module. The app still uses inline JS.
 */

import { COLOR_MAP, generateColorClasses } from './config.js';

export function initThemeToggle(dom) {
    const updateIcons = () => {
        const isDark = document.documentElement.classList.contains('dark');
        if (dom.sunIcon && dom.moonIcon) {
            dom.sunIcon.classList.toggle('hidden', isDark);
            dom.moonIcon.classList.toggle('hidden', !isDark);
        }
    };
    updateIcons();

    if (dom.themeToggle) {
        dom.themeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            localStorage.setItem('darkMode', String(document.documentElement.classList.contains('dark')));
            updateIcons();
        });
    }
}

export function closeSidebar(dom) {
    dom.sidebar.classList.add('-translate-x-full');
    dom.sidebarOverlay.classList.add('hidden');
}

export function toggleSidebar(dom) {
    dom.sidebar.classList.toggle('-translate-x-full');
    dom.sidebarOverlay.classList.toggle('hidden');
}

export function showModal(modal) {
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('[id$="Overlay"]')?.classList.add('opacity-100');
        modal.querySelector('[id$="Panel"]')?.classList.remove('scale-95', 'opacity-0');
        modal.querySelector('[id$="Panel"]')?.classList.add('scale-100', 'opacity-100');
    }, 10);
}

export function hideModal(modal) {
    modal.querySelector('[id$="Overlay"]')?.classList.remove('opacity-100');
    modal.querySelector('[id$="Panel"]')?.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

export function applyModelColorTheme(dom, colorName) {
    const colorClasses = generateColorClasses(colorName);
    const elementsToColor = [dom.newChatBtn, dom.sendBtn];
    const oldBgColors = Object.values(COLOR_MAP).map(c => `bg-${c.name}`);
    const oldHoverBgColors = Object.values(COLOR_MAP).map(c => `hover:bg-${c.name}/90`);

    elementsToColor.forEach(el => {
        if (!el) return;
        el.classList.remove(...oldBgColors, ...oldHoverBgColors);
        el.classList.add(colorClasses.bg, colorClasses.hoverBg);
    });

    if (dom.modelSelectorDot) {
        dom.modelSelectorDot.classList.remove(...oldBgColors);
        dom.modelSelectorDot.classList.add(colorClasses.bg);
    }
}
