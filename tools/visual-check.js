'use strict';
/**
 * REAL-browser visual verification (v2.0.22).
 * Uses @sparticuz/chromium (npm-shipped Chromium binary — no CDN needed)
 * driven by puppeteer-core against the local server.
 *
 * Run: LD_LIBRARY_PATH=/tmp/al2023-libs/lib FONTCONFIG_PATH=/tmp/fonts node tools/visual-check.js
 * Requires: node server.js running on :3000.
 */
const path = require('path');
const fs = require('fs');
const chromium = require('@sparticuz/chromium').default;
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'audits');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

async function runViewport(browser, { w, h, label, mobile }) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile });
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 160)));

    // Mock Firebase BEFORE any app script runs (placeholder creds can't really auth)
    await page.evaluateOnNewDocument(() => {
        const USER = { uid: 'visual-test', displayName: 'Visual Tester', email: 'visual@test.dev', isAnonymous: false, emailVerified: true, photoURL: null };
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
    await new Promise((r) => setTimeout(r, 2500)); // init + fake login + chat render

    const $ = (sel) => page.$(sel);
    const rect = (sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });

    // app shell visible?
    const appVisible = await page.evaluate(() => {
        const app = document.getElementById('app-container');
        return app && app.style.display !== 'none' && app.offsetParent !== null;
    });
    check(`[${label}] app shell visible after mock login`, !!appVisible);

    // B-33: mic removed
    const micCount = await page.evaluate(() => document.querySelectorAll('#voiceBtn').length);
    check(`[${label}] mic button removed (B-33)`, micCount === 0, `count=${micCount}`);

    // B-33/B-35: send & stop share the SAME slot
    const sendR = await rect('#sendBtn');
    const stopR = await rect('#stopBtn');
    const sameSlot = Math.abs(sendR.x - stopR.x) < 2 && Math.abs(sendR.y - stopR.y) < 2 && Math.abs(sendR.w - stopR.w) < 2;
    check(`[${label}] stop overlays send slot exactly (B-35)`, sameSlot, `send(${Math.round(sendR.x)},${Math.round(sendR.y)},${Math.round(sendR.w)}) stop(${Math.round(stopR.x)},${Math.round(stopR.y)},${Math.round(stopR.w)})`);

    // send flush right inside the composer box?
    const boxR = await page.$eval('#messageInput', (el) => { const box = el.closest('div[class*="rounded-2xl"], div[class*="bg-raised"]') || el.parentElement.parentElement; const r = box.getBoundingClientRect(); return { right: r.right, left: r.left }; });
    const flushRight = Math.abs((sendR.x + sendR.w) - (boxR.right - 8)) < 24;
    check(`[${label}] send button flush right (B-33)`, flushRight, `send right=${Math.round(sendR.x + sendR.w)} box right=${Math.round(boxR.right)}`);

    // B-36: bottom padding >= dock height (+headroom) on mobile
    const pad = await page.evaluate(() => {
        const c = document.getElementById('chatHistoryContainer');
        const d = document.getElementById('composerDock');
        return { pad: parseFloat(getComputedStyle(c).paddingBottom), dock: d.getBoundingClientRect().height, scrollable: c.scrollHeight >= c.clientHeight };
    });
    if (mobile) check(`[${label}] scroll padding >= dock height (B-36)`, pad.pad >= pad.dock, `pad=${Math.round(pad.pad)} dock=${Math.round(pad.dock)}`);

    // duplicate ids
    const dups = await page.evaluate(() => {
        const seen = {};
        document.querySelectorAll('[id]').forEach((el) => { seen[el.id] = (seen[el.id] || 0) + 1; });
        return Object.entries(seen).filter(([, n]) => n > 1).map(([id]) => id);
    });
    check(`[${label}] no duplicate ids`, dups.length === 0, dups.join(','));

    // screenshots
    await page.screenshot({ path: path.join(OUT, `visual-${label}-full.png`) });
    const dockR = await rect('#composerDock');
    await page.screenshot({ path: path.join(OUT, `visual-${label}-composer.png`), clip: { x: 0, y: Math.max(0, h - 340), width: w, height: Math.min(340, h) } });

    // send a message → real server → 401 JSON → in-place error card should render
    await page.type('#messageInput', 'visual probe');
    await page.click('#sendBtn');
    await new Promise((r) => setTimeout(r, 1200));
    const errCard = await page.evaluate(() => {
        const card = document.querySelector('[role="alert"]');
        return card ? card.textContent.slice(0, 120) : null;
    });
    check(`[${label}] error surfaces as visible card (B-20/B-34)`, !!errCard, errCard || 'none');

    // stop button becomes visible during stream? (fast 401 — check class swap happened)
    const stopCleared = await page.evaluate(() => {
        const sb = document.getElementById('stopBtn');
        return sb.classList.contains('stop-hidden');
    });
    check(`[${label}] stop button re-hidden after stream ends`, stopCleared);

    // final screenshot with the error card
    await page.screenshot({ path: path.join(OUT, `visual-${label}-error.png`), fullPage: false });

    if (consoleErrors.length) results.push(`--- console errors (${label}) ---\n` + consoleErrors.slice(0, 5).join('\n'));
    await page.close();
    return;
}

(async () => {
    const executablePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
        executablePath,
        headless: 'shell',
    });

    try {
        await runViewport(browser, { w: 375, h: 812, label: 'mobile', mobile: true });
        await runViewport(browser, { w: 1280, h: 800, label: 'desktop', mobile: false });
    } finally {
        await browser.close();
    }

    const fails = results.filter((r) => r.startsWith('FAIL')).length;
    fs.writeFileSync(path.join(OUT, 'visual-check-results.txt'), results.join('\n'));
    console.log(`\n${fails} FAILURE(S) — screenshots in docs/audits/`);
    process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('VISUAL CHECK CRASHED:', e); process.exit(1); });
