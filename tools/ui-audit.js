'use strict';
/**
 * UI/UX audit — real-browser, HARD-FAIL (owner directive, 2.4.9).
 *
 * Every check fails the run (exit 1). There is no warning tier: per the
 * owner, "close to hard fail, dont warn — fix is imminent".
 *
 * Groups (owner-approved list, 2.4.9):
 *   G01 size      — mobile targets: 44px shell controls (WCAG 2.5.5) + 24px
 *                   compact message actions (WCAG 2.5.8 AA). The app roots at
 *                   15px, so shell controls use px-literal sizes (h-11 = 41.25).
 *   G02 tooltip   — chat ⋮ bubble must not overlap the chat name
 *   G03 colors    — landmark surfaces/paint come from theme tokens, no strays
 *   G04 layout    — popovers/tooltips don't disturb scroll or add scrollbars
 *   G05 stacking  — open popovers own their own hit-test point (topmost)
 *   G06 overflow  — long names/URLs ellipsize/wrap instead of stretching
 *   G07 contrast  — WCAG ≥4.5:1 text, ≥3:1 icon-only controls, light+dark
 *   G08 motion    — no CSS transition/animation over 300ms (allowlisted loops)
 *   G09 fonts     — PJS body · JBM code · Cabinet Grotesk wordmark · SS4 display
 *   G10 spacing   — paddings/gaps stay on the 2px grid (no drift values)
 *   G11 actions   — message action contract (user 3 · AI hover 2 + static end 2)
 *
 * Run:       npm run ui:audit        (needs `node server.js` on :3000)
 * Browser:   local Chrome/Edge auto-detected; ABOT_CHROME=<path> overrides.
 * Output:    docs/audits/ui-audit-*.png + ui-audit-results.txt (gitignored).
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

let chromium = null;
try { chromium = require('@sparticuz/chromium').default; } catch { chromium = null; }

const LOCAL_BROWSERS = [
    process.env.ABOT_CHROME,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

async function launchBrowser() {
    const forced = process.env.ABOT_CHROME;
    if (!forced && chromium) {
        return puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: await chromium.executablePath(),
            headless: 'shell',
        });
    }
    const localExe = forced || LOCAL_BROWSERS.find((p) => p && fs.existsSync(p));
    if (!localExe) throw new Error('No Chromium available: install @sparticuz/chromium (sandbox) or set ABOT_CHROME=<path-to-chrome>');
    console.log(`[ui-audit] using local browser: ${localExe}`);
    return puppeteer.launch({
        executablePath: localExe,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
        headless: true,
    });
}

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'audits');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let fails = 0;
const check = (group, name, ok, detail = '') => {
    const line = `${ok ? 'PASS' : 'FAIL'} [${group}] ${name}${detail ? ' — ' + detail : ''}`;
    results.push(line);
    console.log(line);
    if (!ok) fails++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Chrome returns layout-resolved values for pseudo-element styles, so this is
// how the audit measures the CSS-only tooltip bubbles.
const TOOLTIP_GEOM = `(el) => {
    const cs = getComputedStyle(el, '::after');
    if (cs.display === 'none') return null;
    const r = el.getBoundingClientRect();
    const num = (v) => parseFloat(v) || 0;
    return {
        opacity: num(cs.opacity),
        left: r.left + num(cs.left),
        top: r.top + num(cs.top),
        width: num(cs.width),
        height: num(cs.height),
    };
}`;

async function seedChats(page) {
    await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        const chatMod = await import('/js/chat.js');
        state.chats = {
            seed1: {
                id: 'seed1',
                name: 'A very long chat name that should ellipsize inside the rail instead of stretching it wider',
                model: 'groq/openai/gpt-oss-120b',
                messages: [
                    { role: 'user', content: 'Probe question about spacing and actions.', model: 'groq/openai/gpt-oss-120b', ts: Date.now() },
                    {
                        role: 'assistant',
                        model: 'groq/openai/gpt-oss-120b',
                        ts: Date.now(),
                        content: 'Probe reply with **markdown**, a `code span` and a block:\n\n```js\nconst audit = true;\n```\n\n' + 'Long unbroken url: https://example.com/' + 'x'.repeat(140) + ' end.',
                    },
                ],
            },
        };
        state.activeChatId = 'seed1';
        chatMod.renderChatList();
        chatMod.renderActiveChat();
    });
    await sleep(200);
}

async function runViewport(browser, { w, h, label, mobile }) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile });
    const consoleErrors = [];
    // Expected noise: we abort /service-worker.js + all cross-origin requests,
    // and Chrome reports every blocked fetch as "Failed to load resource".
    const noise = (t) => t.includes('Failed to load resource: net::ERR_FAILED');
    page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) consoleErrors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 160)));

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const u = req.url();
        // The SW precache storm (~24 assets per registration) trips the local
        // server's 100 req/15 min limiter after a couple of audit runs — each
        // run uses a throwaway browser profile, so the SW buys us nothing.
        if (u.endsWith('/service-worker.js')) return req.abort();
        const sameOrigin = u.startsWith('http://localhost:3000/') || u.startsWith('http://127.0.0.1:3000/') || u.startsWith('data:');
        return sameOrigin ? req.continue() : req.abort();
    });

    await page.evaluateOnNewDocument(() => {
        const USER = { uid: 'ui-audit', displayName: 'Audit', email: 'audit@test.dev', isAnonymous: false, emailVerified: true, photoURL: null };
        const doc = () => ({
            set: () => Promise.resolve(), update: () => Promise.resolve(), delete: () => Promise.resolve(),
            get: () => Promise.resolve({ exists: false, empty: true, forEach: () => { } }),
            collection: () => ({ doc, add: () => Promise.resolve() }),
        });
        const coll = () => ({ doc, add: () => Promise.resolve(), get: () => Promise.resolve({ empty: true, forEach: () => { } }), where: () => ({ get: () => Promise.resolve({ empty: true, forEach: () => { } }) }), orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ empty: true, forEach: () => { } }) }) }) });
        const authObj = {
            onAuthStateChanged: (cb) => { setTimeout(() => cb(USER), 80); return () => { }; },
            get currentUser() { return USER; },
            signInAnonymously: () => Promise.resolve(USER),
            signInWithEmailAndPassword: () => Promise.resolve({ user: USER }),
            createUserWithEmailAndPassword: () => Promise.resolve({ user: USER }),
            sendPasswordResetEmail: () => Promise.resolve(),
            signOut: () => Promise.resolve(),
        };
        window.firebase = {
            initializeApp: () => ({}),
            auth: () => authObj,
            firestore: () => ({ collection: coll, doc }),
            GoogleAuthProvider: function () { },
        };
        window.marked = { parse: (s) => String(s) };
        window.hljs = { highlightElement: () => { } };
    });

    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2200);

    const appVisible = await page.evaluate(() => {
        const app = document.getElementById('app-container');
        return app && app.style.display !== 'none';
    });
    check('SHELL', `[${label}] app shell visible after mock login`, !!appVisible);
    if (!appVisible) {
        results.push(`--- console errors (${label}) ---\n` + consoleErrors.slice(0, 6).join('\n'));
        await page.close();
        return;
    }

    await seedChats(page);

    // ------------------------------------------------------------------ G01
    // Mobile tap targets: shell controls land on the 44px minimum (WCAG
    // 2.5.5); message action buttons are the owner-spec'd compact affordances,
    // held to the WCAG 2.5.8 AA floor of 24px.
    if (mobile) {
        await page.click('#sidebarToggle'); // drawer on mobile: #newChatBtn lives inside
        await sleep(350);
        const sizeProbe = await page.evaluate(() => {
            const out = {};
            for (const sel of ['#sidebarToggle', '#sendBtn', '#stopBtn', '#modelSelectorBtn', '#newChatBtn', '#headerSearchBtn', '#sidebarCloseBtn']) {
                const el = document.querySelector(sel);
                if (el) { const r = el.getBoundingClientRect(); out[sel] = { w: Math.round(r.width), h: Math.round(r.height) }; }
            }
            const act = document.querySelector('.msg-actions-end .copy-message-btn');
            if (act) { const r = act.getBoundingClientRect(); out['.msg-actions-end .copy-message-btn'] = { w: Math.round(r.width), h: Math.round(r.height) }; }
            return out;
        });
        for (const [sel, s] of Object.entries(sizeProbe)) {
            const floor = sel.includes('msg-actions-end') ? 24 : 44;
            check('G01 size', `[${label}] ${sel} ≥ ${floor}px (${s.w}×${s.h})`, s.w >= floor && s.h >= floor);
        }
        await page.click('#sidebarCloseBtn');
        await sleep(300);
    } else {
        // ------------------------------------------------------------------ G02
        // Chat ⋮ tooltip must open beside the row (into the main pane), never
        // over the chat name it belongs to.
        await page.hover('.chat-list-item .chat-options-btn');
        await sleep(2900); // 2.5s hover delay + 150ms transition + settle
        const tip = await page.evaluate(`(${TOOLTIP_GEOM})(document.querySelector('.chat-list-item .chat-options-btn'))`);
        // The name span is inline inside a truncating anchor — its own rect is
        // the full unclipped text width, so the row anchor is the visible box.
        const nameRect = await page.$eval('.chat-list-item a[data-chat-id]', (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
        check('G02 tooltip', `[${label}] chat ⋮ tooltip actually appears`, !!tip && tip.opacity === 1, tip ? `opacity=${tip.opacity}` : 'no pseudo');
        if (tip) {
            const overlaps = tip.left < nameRect.right - 1 && (tip.top < nameRect.bottom && tip.top + tip.height > nameRect.top);
            check('G02 tooltip', `[${label}] chat ⋮ tooltip clears the chat name`, !overlaps,
                `tooltip.left=${Math.round(tip.left)} name.right=${Math.round(nameRect.right)}`);
        }
        // tooltip must not disturb scroll containers either
        const preTip = await page.evaluate(() => {
            const c = document.getElementById('chatHistoryContainer');
            return { sw: c.scrollWidth, sh: c.scrollHeight };
        });
        await page.mouse.move(5, 5);
        await sleep(250);
        const postTip = await page.evaluate(() => {
            const c = document.getElementById('chatHistoryContainer');
            return { sw: c.scrollWidth, sh: c.scrollHeight };
        });
        check('G04 layout', `[${label}] tooltip hover leaves chat scroll size unchanged`, preTip.sw === postTip.sw && preTip.sh === postTip.sh);
    }

    // ------------------------------------------------------------------ G03
    // Landmark paint must resolve to theme tokens in BOTH themes.
    const colorPass = await page.evaluate(async () => {
        const parse = (c) => {
            const m = c.match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number);
            return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
        };
        const toHex = ({ r, g, b, a }) => `rgba(${r}, ${g}, ${b}, ${a})`;
        const tokenSet = () => {
            const cs = getComputedStyle(document.documentElement);
            const names = ['--c-canvas', '--c-card', '--c-raised', '--c-hairline', '--c-ink', '--c-body', '--c-muted', '--c-coral', '--c-coral-active', '--c-coral-soft'];
            const set = new Set(['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)', 'rgba(255, 255, 255, 1)', 'rgb(0, 0, 0)']);
            for (const n of names) {
                const raw = cs.getPropertyValue(n).trim();
                if (!raw) continue;
                const [r, g, b] = raw.split(/\s+/).map(Number);
                for (const a of [0.28, 0.45, 0.5, 0.6, 0.7, 0.72, 0.78, 0.8, 0.92, 1]) {
                    set.add(`rgb(${r}, ${g}, ${b})`);
                    if (a < 1) set.add(`rgba(${r}, ${g}, ${b}, ${a})`);
                }
            }
            return set;
        };
        const out = [];
        const probe = (sel, prop, tokenHint) => {
            const el = document.querySelector(sel);
            if (!el) return;
            out.push({ sel, prop, value: getComputedStyle(el)[prop], tokenHint });
        };
        for (const theme of ['light', 'dark']) {
            document.documentElement.classList.toggle('dark', theme === 'dark');
            await new Promise((r) => setTimeout(r, 60));
            const tokens = tokenSet();
            const probes = [];
            const add = (sel, prop) => {
                const el = document.querySelector(sel);
                if (el) probes.push({ sel, prop, value: getComputedStyle(el)[prop] });
            };
            add('body', 'backgroundColor'); add('body', 'color');
            add('#sidebar', 'color');
            add('.user-bubble', 'backgroundColor'); add('.user-bubble', 'color');
            add('.msg-actions-end .copy-message-btn', 'color');
            add('.model-avatar, [class*="rounded-md"][class*="flex items-center justify-center"]', 'color');
            for (const p of probes) {
                const bg = parse(p.value);
                if (!bg) continue;
                const ok = tokens.has(`rgb(${bg.r}, ${bg.g}, ${bg.b})`) || (bg.a < 1 && tokens.has(`rgba(${bg.r}, ${bg.g}, ${bg.b}, ${bg.a})`));
                out.push({ theme, ...p, ok });
            }
        }
        document.documentElement.classList.remove('dark');
        await new Promise((r) => setTimeout(r, 60));
        return out;
    });
    for (const p of colorPass) {
        if (p.ok === undefined) continue;
        check('G03 colors', `[${label}] ${p.theme} ${p.sel} ${p.prop} is a theme token`, p.ok, p.value);
    }
    const strayInline = await page.evaluate(() => {
        const stray = [];
        document.querySelectorAll('#chatHistory [style*="#"], #sidebar [style*="#"]').forEach((el) => stray.push(el.className.slice(0, 40)));
        return stray.slice(0, 5);
    });
    check('G03 colors', `[${label}] no inline hex colors in rendered chat/sidebar`, strayInline.length === 0, strayInline.join(' | '));

    // ------------------------------------------------------------------ G04/G05
    // Model panel: opens without disturbing scroll size, stays in the viewport,
    // and owns its hit-test point (nothing overlays it).
    {
        const pre = await page.evaluate(() => {
            const c = document.getElementById('chatHistoryContainer');
            return { sw: c.scrollWidth, sh: c.scrollHeight, docW: document.documentElement.scrollWidth, win: window.innerWidth };
        });
        await page.click('#modelSelectorBtn');
        await sleep(300);
        const post = await page.evaluate(() => {
            const c = document.getElementById('chatHistoryContainer');
            const panel = document.getElementById('modelSelectorPanel');
            const r = panel.getBoundingClientRect();
            const top = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)[0];
            return {
                sw: c.scrollWidth, sh: c.scrollHeight,
                docW: document.documentElement.scrollWidth, win: window.innerWidth,
                inViewport: r.left >= -0.5 && r.right <= window.innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5,
                topmost: !!(top && top.closest('#modelSelectorPanel')),
            };
        });
        check('G04 layout', `[${label}] model panel open: chat scroll size unchanged`, pre.sw === post.sw && pre.sh === post.sh);
        check('G04 layout', `[${label}] model panel open: no horizontal page scrollbar`, post.docW <= post.win, `doc=${post.docW} win=${post.win}`);
        check('G04 layout', `[${label}] model panel fully inside viewport`, post.inViewport);
        check('G05 stacking', `[${label}] model panel is topmost at its own centre`, post.topmost);
        await page.keyboard.press('Escape');
        await sleep(120);
    }
    // Chat ⋮ menu: same contract. (On mobile the rail is a closed drawer —
    // open it first, or the button has no clickable point.)
    {
        if (mobile) { await page.click('#sidebarToggle'); await sleep(350); }
        await page.click('.chat-list-item .chat-options-btn');
        await sleep(200);
        const menu = await page.evaluate(() => {
            const m = document.querySelector('.chat-options-menu:not(.hidden)');
            if (!m) return { open: false };
            const r = m.getBoundingClientRect();
            const top = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)[0];
            return { open: true, inViewport: r.left >= -0.5 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5, topmost: !!(top && top.closest('.chat-options-menu')) };
        });
        check('G04 layout', `[${label}] chat ⋮ menu fits in viewport`, menu.open && menu.inViewport);
        check('G05 stacking', `[${label}] chat ⋮ menu is topmost at its own centre`, menu.open && menu.topmost);
        await page.keyboard.press('Escape');
        await sleep(120);
        if (mobile) { await page.click('#sidebarCloseBtn'); await sleep(300); }
    }

    // ------------------------------------------------------------------ G06
    {
        const ov = await page.evaluate(() => {
            const anchor = document.querySelector('.chat-list-item a[data-chat-id]');
            const sidebar = document.getElementById('sidebar');
            const prose = document.querySelector('#chatHistory .prose');
            return {
                nameEllipsized: !!anchor && anchor.scrollWidth > anchor.clientWidth && anchor.clientWidth < sidebar.getBoundingClientRect().width,
                proseContained: !!prose && prose.scrollWidth <= prose.clientWidth + 1,
                proseOverflow: prose ? prose.scrollWidth - prose.clientWidth : 0,
            };
        });
        check('G06 overflow', `[${label}] long chat name ellipsizes inside the rail`, ov.nameEllipsized);
        check('G06 overflow', `[${label}] long unbroken URL wraps inside the reply`, ov.proseContained, `overflow=${ov.proseOverflow}px`);
    }

    // ------------------------------------------------------------------ G07
    // WCAG contrast: text ≥4.5:1, icon-only controls ≥3:1 — both themes.
    const contrastPass = await page.evaluate(async () => {
        const parse = (c) => {
            const m = c.match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number);
            return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
        };
        const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
        const lum = ({ r, g, b }) => {
            const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
        const bgOf = (el) => {
            for (let n = el; n; n = n.parentElement) {
                const c = parse(getComputedStyle(n).backgroundColor);
                if (c && c.a > 0.95) return c;
            }
            return { r: 255, g: 255, b: 255, a: 1 };
        };
        const out = [];
        const probe = (label, sel, isIcon, root = document) => {
            const el = root.querySelector(sel);
            if (!el) return;
            const fgRaw = parse(getComputedStyle(el).color);
            const bg = bgOf(el);
            const fg = fgRaw.a < 1 ? blend(fgRaw, bg) : fgRaw;
            out.push({ label, ratio: ratio(fg, bg), floor: isIcon ? 3 : 4.5 });
        };
        for (const theme of ['light', 'dark']) {
            document.documentElement.classList.toggle('dark', theme === 'dark');
            await new Promise((r) => setTimeout(r, 60));
            probe(`[${theme}] body text on canvas`, 'body');
            probe(`[${theme}] chat name`, '.chat-list-item .chat-name-span');
            probe(`[${theme}] message timestamp`, '.msg-timestamp');
            probe(`[${theme}] user bubble text`, '.user-bubble', false);
            probe(`[${theme}] AI reply text`, '#chatHistory .prose');
            probe(`[${theme}] end-row copy icon`, '.msg-actions-end .copy-message-btn', true);
            probe(`[${theme}] end-row speak icon`, '.msg-actions-end .speak-btn', true);
            probe(`[${theme}] meta copy icon`, '.message-container .copy-message-btn', true);
            probe(`[${theme}] model label`, 'span[class*="text-provider-"]');
        }
        document.documentElement.classList.remove('dark');
        await new Promise((r) => setTimeout(r, 60));
        return out;
    });
    for (const p of contrastPass) {
        check('G07 contrast', `[${label}] ${p.label} ≥ ${p.floor}:1 (${p.ratio.toFixed(2)}:1)`, p.ratio >= p.floor);
    }

    // ------------------------------------------------------------------ G08
    // No CSS transition/animation over 300ms outside the allowlisted loops.
    {
        const motion = await page.evaluate(() => {
            // Owner-approved exceptions: the 2.4.4 sidebar glide (deliberate
            // 480ms drawer curve) + decorative loops (cursor blink, dotmark,
            // typing "A", sparkles, spinners).
            // 2.8.10 (owner directive 2026-11-08): the auth page is frozen as
            // built. `.auth-bloom` is two huge background colour washes that
            // drift over 52s/68s — atmosphere, not UI feedback, so the 300ms
            // interaction ceiling does not apply. `.auth-rise` is the 520ms
            // staged entrance of the sign-in column, kept deliberately.
            const ALLOW = ['.blinking-cursor', '.dotmark circle', '.typing-a circle', '.sparkle', '.sidebar', '.animate-spin', '.auth-bloom', '.auth-rise'];
            const bad = [];
            document.querySelectorAll('body *').forEach((el) => {
                if (ALLOW.some((s) => el.matches(s))) return;
                const cs = getComputedStyle(el);
                for (const v of cs.transitionDuration.split(',')) {
                    if (v.endsWith('ms') && parseFloat(v) > 300) bad.push({ sel: el.className.toString().slice(0, 50), v });
                    else if (v.endsWith('s') && parseFloat(v) > 0.3) bad.push({ sel: el.className.toString().slice(0, 50), v });
                }
                for (const v of cs.animationDuration.split(',')) {
                    if (v.endsWith('ms') && parseFloat(v) > 300) bad.push({ sel: el.className.toString().slice(0, 50) || el.tagName, v });
                    else if (v.endsWith('s') && parseFloat(v) > 0.3) bad.push({ sel: el.className.toString().slice(0, 50) || el.tagName, v });
                }
            });
            return [...new Map(bad.map((b) => [b.sel + '|' + b.v, b])).values()].slice(0, 8);
        });
        check('G08 motion', `[${label}] no transition/animation over 300ms`, motion.length === 0, motion.map((m) => `${m.sel}=${m.v}`).join(' | '));
    }

    // ------------------------------------------------------------------ G09
    {
        const fonts = await page.evaluate(async () => {
            await document.fonts.load('700 15px "Cabinet Grotesk"');
            await document.fonts.load('400 15px "Plus Jakarta Sans"');
            await document.fonts.ready;
            const fam = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '') : ''; };
            return {
                body: fam('body'),
                user: fam('.user-bubble'),
                ai: fam('#chatHistory .prose'),
                code: fam('#chatHistory .prose pre code'),
                inlineCode: fam('#chatHistory .prose code'),
                wordmark: fam('.font-wordmark'),
                loaded: {
                    pjs: document.fonts.check('400 15px "Plus Jakarta Sans"'),
                    cg: document.fonts.check('700 15px "Cabinet Grotesk"'),
                    jbm: document.fonts.check('400 13px "JetBrains Mono"'),
                    ss4: document.fonts.check('400 16px "Source Serif 4"'),
                },
            };
        });
        check('G09 fonts', `[${label}] body text = Plus Jakarta Sans`, fonts.body === 'Plus Jakarta Sans', fonts.body);
        check('G09 fonts', `[${label}] user text = Plus Jakarta Sans`, fonts.user === 'Plus Jakarta Sans', fonts.user);
        check('G09 fonts', `[${label}] AI reply = Plus Jakarta Sans`, fonts.ai === 'Plus Jakarta Sans', fonts.ai);
        check('G09 fonts', `[${label}] code blocks = JetBrains Mono`, fonts.code === 'JetBrains Mono', fonts.code);
        check('G09 fonts', `[${label}] inline code = JetBrains Mono`, fonts.inlineCode === 'JetBrains Mono', fonts.inlineCode);
        check('G09 fonts', `[${label}] wordmark = Cabinet Grotesk`, fonts.wordmark === 'Cabinet Grotesk', fonts.wordmark);
        check('G09 fonts', `[${label}] all four faces loaded (PJS · CG · JBM · SS4)`,
            fonts.loaded.pjs && fonts.loaded.cg && fonts.loaded.jbm && fonts.loaded.ss4, JSON.stringify(fonts.loaded));
    }

    // ------------------------------------------------------------------ G10
    // "Spaces" contract: paddings + gaps of the audited surfaces must land on
    // the Tailwind spacing scale (measured against the 15px root, so 12px
    // spacing is 11.25px computed — the rule is scale-membership, not integers).
    {
        const spacing = await page.evaluate(() => {
            const rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 15;
            const scale = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6];
            const allowed = scale.map((u) => u * rootFs);
            const targets = ['.user-bubble', '.msg-actions-end', '.chat-list-item a', '.abot-toast', '#modelSelectorPanel'];
            const bad = [];
            for (const sel of targets) {
                const el = document.querySelector(sel);
                if (!el) continue;
                const cs = getComputedStyle(el);
                for (const prop of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'columnGap', 'rowGap']) {
                    const v = parseFloat(cs[prop]);
                    if (!Number.isFinite(v) || v === 0) continue;
                    if (!allowed.some((a) => Math.abs(a - v) < 0.6)) bad.push(`${sel} ${prop}=${cs[prop]}`);
                }
            }
            return bad;
        });
        check('G10 spacing', `[${label}] paddings/gaps on the spacing scale`, spacing.length === 0, spacing.join(' | '));
    }

    // ------------------------------------------------------------------ G11
    // Message action contract: user row = copy · read aloud · edit; AI row =
    // hover pair kept + static end row (always opaque, below the reply).
    {
        const actions = await page.evaluate(() => {
            const userRow = document.querySelector('#chatHistory .message-container.justify-end');
            const aiRows = [...document.querySelectorAll('#chatHistory .message-container:not(.justify-end)')];
            const ai = aiRows[aiRows.length - 1];
            const end = ai ? ai.querySelector('.msg-actions-end') : null;
            const endCopy = end ? end.querySelector('.copy-message-btn') : null;
            const endSpeak = end ? end.querySelector('.speak-btn') : null;
            const topmost = endCopy ? document.elementsFromPoint(...(() => { const r = endCopy.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })())[0] : null;
            const prose = ai ? ai.querySelector('.prose') : null;
            return {
                userLabels: userRow ? [...userRow.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')) : [],
                aiCopyCount: ai ? ai.querySelectorAll('.copy-message-btn').length : 0,
                aiSpeakCount: ai ? ai.querySelectorAll('.speak-btn').length : 0,
                endExists: !!end,
                endIsLast: end && ai ? ai.lastElementChild === end : false,
                endCopyOpacity: endCopy ? getComputedStyle(endCopy).opacity : null,
                endSpeakOpacity: endSpeak ? getComputedStyle(endSpeak).opacity : null,
                endBelowProse: end && prose ? end.getBoundingClientRect().top >= prose.getBoundingClientRect().bottom - 1 : false,
                endHitTarget: !!(topmost && topmost.closest('.msg-actions-end')),
                speakPressed: endSpeak ? endSpeak.getAttribute('aria-pressed') : null,
            };
        });
        const want = ['Copy message', 'Read aloud', 'Edit message'];
        check('G11 actions', `[${label}] user row = copy · read aloud · edit`, JSON.stringify(actions.userLabels) === JSON.stringify(want), actions.userLabels.join(', '));
        check('G11 actions', `[${label}] AI row keeps hover pair + static end pair`, actions.aiCopyCount === 2 && actions.aiSpeakCount === 2, `copy=${actions.aiCopyCount} speak=${actions.aiSpeakCount}`);
        check('G11 actions', `[${label}] end row is the reply's last block`, actions.endExists && actions.endIsLast);
        check('G11 actions', `[${label}] end-row buttons statically visible (no hover)`, actions.endCopyOpacity === '1' && actions.endSpeakOpacity === '1', `copy=${actions.endCopyOpacity} speak=${actions.endSpeakOpacity}`);
        check('G11 actions', `[${label}] end row sits below the reply text`, actions.endBelowProse);
        check('G11 actions', `[${label}] end-row copy button is the topmost hit target`, actions.endHitTarget);
        check('G11 actions', `[${label}] end-row speak starts unpressed`, actions.speakPressed === 'false');
    }

    if (consoleErrors.length) results.push(`--- console errors (${label}) ---\n` + consoleErrors.slice(0, 6).join('\n'));
    await page.screenshot({ path: path.join(OUT, `ui-audit-${label}.png`) });
    await page.close();
}

(async () => {
    // The audit needs the real app served — fail fast + clear when it's not.
    try {
        const res = await fetch('http://localhost:3000/', { method: 'HEAD' }).catch(() => null);
        if (!res) throw new Error('unreachable');
    } catch {
        console.error('FAIL [SHELL] local server unreachable — start it first:  node server.js');
        process.exit(1);
    }

    const browser = await launchBrowser();
    try {
        await runViewport(browser, { w: 1366, h: 768, label: 'desktop', mobile: false });
        await runViewport(browser, { w: 412, h: 915, label: 'mobile', mobile: true });
    } finally {
        await browser.close();
    }

    fs.writeFileSync(path.join(OUT, 'ui-audit-results.txt'), results.join('\n'));
    console.log(`\n${fails} UI-AUDIT FAILURE(S) — screenshots + log in docs/audits/`);
    process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('UI AUDIT CRASHED:', e); process.exit(1); });
