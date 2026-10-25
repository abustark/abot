'use strict';
/**
 * Palette previewer — renders the REAL app under candidate colour themes and
 * screenshots each one, so the owner can compare before any code is committed.
 *
 * Nothing is written to the repo's CSS: each palette is injected as a
 * document-level CSS-variable override, so the app you see is the shipping UI.
 *
 * Run:  LD_LIBRARY_PATH=/tmp/al2023-libs/lib FONTCONFIG_PATH=/tmp/fonts \
 *       node tools/palette-preview.js
 * Needs: node server.js on :3000  +  @sparticuz/chromium + puppeteer-core
 * Output: docs/audits/palette-<id>-<view>-<mode>.png
 */
const path = require('path');
const fs = require('fs');
const chromium = require('@sparticuz/chromium').default;
const puppeteer = require('puppeteer-core');

const OUT = path.join(__dirname, '..', 'docs', 'audits');
fs.mkdirSync(OUT, { recursive: true });

// Each palette = the 11 chrome tokens per mode. `rgb()` triplets, as Tailwind expects.
// accent slot is the historical `--c-coral*` name.
const PALETTES = {
    current: {
        label: 'Current — Petrol & sand (2.6.7)',
        light: null, // = ship as-is
        dark: null,
    },
    oxblood: {
        label: 'A — Oxblood & bone',
        light: {
            canvas: '247 246 243', surface: '242 240 236', card: '239 236 230', raised: '253 252 250',
            hairline: '228 224 217', ink: '22 19 15', body: '67 64 58', muted: '107 101 93',
            accent: '125 31 61', active: '95 21 45', soft: '240 230 234',
        },
        dark: {
            canvas: '20 18 16', surface: '27 24 21', card: '32 29 25', raised: '38 34 30',
            hairline: '52 47 42', ink: '245 242 236', body: '221 216 207', muted: '162 154 143',
            accent: '224 138 158', active: '242 168 184', soft: '46 30 36',
        },
    },
    copper: {
        label: 'B — Copper & graphite',
        light: {
            canvas: '245 246 247', surface: '240 241 243', card: '236 237 239', raised: '252 253 253',
            hairline: '224 226 229', ink: '20 23 26', body: '62 67 72', muted: '93 100 107',
            accent: '154 74 31', active: '120 56 15', soft: '243 233 226',
        },
        dark: {
            canvas: '19 20 22', surface: '25 27 30', card: '29 31 34', raised: '35 38 41',
            hairline: '48 51 55', ink: '243 244 245', body: '220 221 224', muted: '155 161 167',
            accent: '229 154 106', active: '242 176 136', soft: '47 36 28',
        },
    },
    citron: {
        label: 'C — Citron & slate',
        light: {
            canvas: '246 247 244', surface: '241 242 238', card: '236 238 232', raised: '252 253 251',
            hairline: '225 227 221', ink: '18 21 15', body: '61 66 58', muted: '102 107 98',
            accent: '63 98 18', active: '47 74 13', soft: '234 240 226',
        },
        dark: {
            canvas: '18 20 17', surface: '24 27 23', card: '29 32 28', raised: '35 38 34',
            hairline: '47 51 45', ink: '244 246 242', body: '220 224 217', muted: '154 160 150',
            accent: '184 233 134', active: '205 245 165', soft: '38 46 34',
        },
    },
};

function cssFor(vars) {
    const map = {
        '--c-canvas': vars.canvas, '--c-surface': vars.surface, '--c-card': vars.card,
        '--c-raised': vars.raised, '--c-hairline': vars.hairline, '--c-ink': vars.ink,
        '--c-body': vars.body, '--c-muted': vars.muted,
        '--c-coral': vars.accent, '--c-coral-active': vars.active, '--c-coral-soft': vars.soft,
        '--c-shadow': vars.ink,
    };
    return Object.entries(map).map(([k, v]) => `${k}: ${v};`).join(' ');
}

async function shoot(browser, { id, label, mode, view, dark }) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 820, deviceScaleFactor: 1 });

    // mock auth so we land inside the app
    await page.evaluateOnNewDocument((isDark) => {
        const USER = { uid: 'p', displayName: 'ABu', email: 'abu@abot.dev', isAnonymous: false, emailVerified: true, photoURL: null };
        const doc = () => ({ set: () => Promise.resolve(), update: () => Promise.resolve(), delete: () => Promise.resolve(), get: () => Promise.resolve({ exists: true, data: () => ({}) }) });
        const chain = () => ({ doc, add: () => Promise.resolve(), get: () => Promise.resolve({ empty: true, forEach: () => { } }), where: () => chain(), orderBy: () => chain(), limit: () => chain() });
        window.firebase = {
            initializeApp: () => ({}),
            auth: () => ({ onAuthStateChanged: (cb) => setTimeout(() => cb(USER), 60), get currentUser() { return USER; }, signOut: () => Promise.resolve() }),
            firestore: () => ({ collection: chain, doc }),
        };
        window.marked = { parse: (s) => String(s) };
        window.hljs = { highlightElement: () => { } };
        if (!isDark) document.documentElement.classList.remove('dark');
        else document.documentElement.classList.add('dark');
    }, dark);

    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2200));

    // Force the mode AFTER load — the app's own theme script re-applies its
    // stored preference during init, so setting the class earlier gets undone.
    await page.evaluate((isDark) => {
        document.documentElement.classList.toggle('dark', isDark);
        try { localStorage.setItem('darkMode', isDark ? 'true' : 'false'); } catch { }
    }, dark);
    await new Promise((r) => setTimeout(r, 250));

    if (view.palette) {
        await page.addStyleTag({
            content: dark
                ? `.dark { ${cssFor(view.palette.dark)} }`
                : `:root { ${cssFor(view.palette.light)} }`,
        });
        await new Promise((r) => setTimeout(r, 150));
    }

    // sanity: what the renderer actually resolved
    const resolved = await page.evaluate(() => {
        const cs = getComputedStyle(document.body);
        return { bg: cs.backgroundColor, isDark: document.documentElement.classList.contains('dark') };
    });
    if (resolved.isDark !== dark) console.log(`  WARN ${id}/${mode}: dark class=${resolved.isDark}`);

    // Paint a representative conversation straight into the DOM so the bubble
    // surfaces (user bubble / AI on canvas) can be judged without a live model.
    if (view.chat) {
        await page.evaluate(() => {
            const hist = document.getElementById('chatHistory');
            if (!hist) return;
            document.body.classList.remove('chat-empty');
            const avatar = document.querySelector('.provider-dot, [class*="w-7"][class*="h-7"]');
            hist.innerHTML = `
              <div class="message-container w-full flex flex-col mb-8">
                <div class="flex items-center gap-3 mb-2 select-none">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background: rgb(var(--c-provider-google))">
                    <span class="text-[10px] font-bold" style="color: rgb(var(--c-canvas))">GO</span>
                  </div>
                  <span class="text-xs font-bold uppercase tracking-wider" style="color: rgb(var(--c-provider-google))">Gemini 2.5 Pro</span>
                  <span class="text-xs" style="color: rgb(var(--c-muted))">09:41</span>
                </div>
                <div class="pl-0 md:pl-10 w-full">
                  <div class="prose max-w-none" style="color: rgb(var(--c-ink))">
                    <p>ABot routes every message to the model you pick — Gemini, Groq, NVIDIA or OpenRouter — through one hardened proxy, and keeps the conversation in your own Firestore space.</p>
                    <p>Use the header pill to compare answers side by side.</p>
                  </div>
                </div>
              </div>
              <div class="message-container w-full flex justify-end mb-6">
                <div class="max-w-[90%] md:max-w-[80%] px-5 py-3" style="background: rgb(var(--c-card)); color: rgb(var(--c-ink)); border-radius: 18px 18px 6px 18px;">
                  <div class="prose max-w-none"><p>Nice — so which one is fastest?</p></div>
                </div>
              </div>
              <div class="message-container w-full flex flex-col mb-8">
                <div class="flex items-center gap-3 mb-2 select-none">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background: rgb(var(--c-provider-nvidia))">
                    <span class="text-[10px] font-bold" style="color: rgb(var(--c-canvas))">NV</span>
                  </div>
                  <span class="text-xs font-bold uppercase tracking-wider" style="color: rgb(var(--c-provider-nvidia))">Nemotron 3 Super</span>
                  <span class="text-xs" style="color: rgb(var(--c-muted))">09:41</span>
                </div>
                <div class="pl-0 md:pl-10 w-full">
                  <div class="prose max-w-none" style="color: rgb(var(--c-ink))">
                    <p>On NVIDIA's LPUs the small Nemotron models return first tokens in well under a second — good for quick back-and-forth. For long answers, Gemini Flash is steadier.</p>
                  </div>
                  <div class="flex items-center gap-1 mt-3">
                    <button class="p-1.5 rounded-md" style="color: rgb(var(--c-muted))">Copy</button>
                    <button class="p-1.5 rounded-md" style="color: rgb(var(--c-muted))">Read</button>
                  </div>
                </div>
              </div>`;
        });
        await new Promise((r) => setTimeout(r, 400));
    }

    const file = path.join(OUT, `palette-${id}-${view.key}-${mode}.png`);
    await page.screenshot({ path: file, fullPage: false });
    await page.close();
    return file;
}

(async () => {
    const executablePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
        executablePath,
        headless: 'shell',
    });

    const views = [
        { key: 'auth', chat: false },
        { key: 'chat', chat: true },
    ];

    const made = [];
    try {
        for (const [id, pal] of Object.entries(PALETTES)) {
            for (const mode of ['light', 'dark']) {
                for (const view of views) {
                    const f = await shoot(browser, {
                        id, label: pal.label, mode, dark: mode === 'dark',
                        view: { ...view, palette: pal[mode] ? pal : null },
                    });
                    made.push(f);
                    console.log('shot:', path.basename(f));
                }
            }
        }
    } finally {
        await browser.close();
    }
    console.log(`\n${made.length} screenshots in docs/audits/`);
})().catch((e) => { console.error('PREVIEW CRASHED:', e); process.exit(1); });
