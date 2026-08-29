# UI/UX + Security Baseline Audit — ABot

**Date:** 2026-08-27 · **Branch:** `arena/01a03fe9-abot` · **Phase 0 of IMPLEMENTATION_PLAN.md**
**Method:** Live server (`node server.js` on :3000, placeholder env) + HTTP probes + DOM-level automated audit (jsdom) + code review against the **web-design-guidelines** checklist.

> ⚠️ **Environment limitation:** this sandbox blocks all browser-binary CDNs (playwright.dev, storage.googleapis.com) and has no root, so **real-browser screenshots could not be captured here**. The playwright-cli flows in §5 are ready to run on any unrestricted machine. Findings below are from DOM/code-level analysis — the audit method that does not require rendering.

---

## 1. Security Probes (confirmed)

| Probe | Result | Verdict |
|---|---|---|
| `GET /.env` | 404 (express.static ignores dotfiles) | ✅ partially safe — **but only by library default** |
| `GET /server.js` | **200 — full source served** | 🔴 S1a: source disclosure |
| `GET /package.json` | **200 — served** | 🔴 S1a |
| `GET /.git/config`, `/.git/HEAD` | **200 — full content served** | 🔴 **S1b: entire `.git/` downloadable → full repo history + source disclosure** |
| `GET /api/firebase-config` | 200, returns Firebase web config publicly | 🟢 acceptable by Firebase design (web config is public), note only |
| `POST /api/chat` (no token) | 401 Unauthorized | ✅ auth gate works |

**New/updated findings:** S1 split into **S1a** (non-dotfile files served) and **S1b** (`.git` directory served — critical; `dotfiles:'ignore'` happens to protect `.env` but not `.git` because its files don't start with a dot).
Also confirmed: S4 (`?token=` accepted — code), S5 (Gemini key in URL — code), S2 (no rate limit in api/chat.js — code), S3 (`ACAO:*` + credentials — vercel.json), S6 (no size caps — code), S7 (raw upstream errors — code), S9 (no fetch timeout — code).

---

## 2. Accessibility Findings (web-design-guidelines)

### 🔴 High
| # | Finding | Where |
|---|---|---|
| A1 | **7 buttons without accessible name** (icon-only, no `aria-label`) | index.html |
| A2 | **No `:focus-visible` styles anywhere** in compiled CSS — keyboard users can't see focus | src/input.css |
| A3 | **6 auth inputs missing `autocomplete`** (`login-email`, `login-password`, `signup-email`, `signup-password`, `forgot-password-email`) — also a UX win to fix | index.html |
| A4 | 2 inputs with no label/aria (`chatTitleInput`, `importFileInput`) | index.html |

### 🟠 Medium
- A5: **2 × `<h1>`** on one page (want exactly 1); 1 heading-level jump
- A6: **No `aria-live` regions, no `role="status"`, no `aria-busy`** — streaming responses and chat-list updates are never announced to screen readers

## 3. UX / State Coverage

| State | Present? |
|---|---|
| Loading indicator (spinner/pulse) | ✅ partial — 3 × `animate-pulse` |
| **Skeleton loaders** | ❌ missing |
| **Empty state** (no chats yet) | ❌ missing |
| Announced async updates (aria-live) | ❌ missing |
| Inline event handler attributes | ✅ 0 (good — CSP-friendly) |
| Touch targets | ✅ no obvious sub-44px icon buttons detected |

## 4. Performance / Architecture (baseline numbers)

- **4 synchronous render-blocking `<script>` in `<head>`** (jsdelivr + cdnjs libs)
- **6 external CDN hosts** (fonts.googleapis, fonts.gstatic, jsdelivr, cdnjs, accounts.google, gstatic) → 6 extra DNS/TLS handshakes before interactivity
- Vanta + Three.js loaded from CDN for background only (A4 in plan)
- Page HTML: **148 KB single file** (2,555 lines, all JS inline)

**Baseline design identity (for the Phase-3 before/after):**
- Fonts: **Inter** (UI), **Space Grotesk** (display), **JetBrains Mono** (code)
- Palette: gray-scale Tailwind family — `#111827` (gray-900), `#374151`, `#6b7280`, `#d1d5db`, `#e5e7eb` — cool/neutral, no warm tones

## 5. Deferred to unrestricted machine — exact commands

```bash
npm i -g @playwright/cli@latest && playwright-cli install --skills
playwright-cli open --viewport-size=1440,900 http://localhost:3000
playwright-cli screenshot docs/audits/before-desktop.png
playwright-cli resize 390,844 && playwright-cli screenshot docs/audits/before-mobile.png
```

---

**Phase 0 complete.** Next: **Phase 1 — Backend Security Hardening** (waits for approval per working agreement).
