# ABot - Future Improvements & Suggestions

This file tracks planned improvements and feature ideas for future development.

> ⚠️ **IMPORTANT CONSTRAINT**  
> This project uses **FREE API keys** from all providers (Google, Groq, NVIDIA, OpenRouter).  
> Free tiers have **limited tokens/responses** per minute and per day.  
> Before implementing any feature, consider its impact on API token usage.  
> Avoid features that require excessive AI calls or long context windows.

---

## 🎨 UX Improvements

### High Priority
- [x] **UI Overhaul (ChatGPT/Claude Style)**
  - [x] **Zoom/Scaling Fix**: Reduce default font sizes/paddings (currently too big at 100% zoom)
  - [x] **AI Message Layout**: Remove bubble bg, full width, Avatar + Model Name Header, Timestamp in header
  - [x] **User Message Layout**: Keep bubbles but optimize spacing
  - [x] **Message Actions**: Professional placement (inspired by major AI sites)
  - [x] **Sidebar/Header**: Collapse button, New Chat icon in header

- [ ] **Search within chat messages** - Search message content, not just chat titles
- [x] **Edit individual messages** - Allow editing sent messages
- [x] **Delete individual messages** - Allow deleting specific messages from a chat
- [x] **Keyboard shortcuts**
  - `Ctrl+Enter` - Send message
  - `Esc` - Close modals/sidebars
  - `Alt+N` - New chat
  - `Alt+/` - Focus search
- [ ] **Better loading states** - Skeleton loaders, progress indicators

### Nice to Have
- [ ] Message reactions/ratings
- [ ] Pin important messages
- [ ] Collapse/expand long messages
- [ ] Message timestamps toggle

---

## 🧹 Code Quality

### High Priority
- [ ] **Add TypeScript** - Type safety for better maintainability
- [ ] **Add unit tests** - Jest or Vitest for testing utilities and functions
- [ ] **Separate JavaScript into modules** - Reference files exist in `js/` folder

### Nice to Have
- [ ] Add ESLint for code linting
- [ ] Add Prettier for code formatting
- [ ] Add Husky for pre-commit hooks
- [ ] Add GitHub Actions for CI/CD

---

## ⚡ Performance (Completed)
- [x] Service worker for offline caching
- [x] Fixed all npm vulnerabilities (9 → 0)
- [x] CSP headers configured
- [x] .gitignore updated

---

## 🔒 Security (Completed)
- [x] XSS protection with escapeHtml/sanitizeHtml
- [x] DOMPurify for markdown sanitization
- [x] Helmet.js for security headers
- [x] Firebase config fetched from server

---

## 💡 Feature Ideas (Future)
- [ ] Chat export to PDF/Markdown
- [ ] Chat sharing via link
- [ ] Multiple conversation threads
- [ ] Custom themes/color schemes
- [ ] Mobile app (PWA enhancements)
- [ ] Voice output (text-to-speech)
- [ ] Image upload for vision models
- [ ] Code execution sandbox

---

*Last updated: 2026-02-01*
