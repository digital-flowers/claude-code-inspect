# Publishing Plan — Chrome Web Store

## Phase 1: Pre-submission checklist

### Manifest review
- [x] Bump version from `0.1.0` to `1.0.0` for initial public release
- [x] Update `description` — must be under 132 characters, compelling, keyword-rich
  - Current: `"Click any element on any page and prompt Claude Code about it — instantly, with full context."`
- [x] Justify every permission to Chrome (required for review):
  - `activeTab` — needed to capture the currently active tab for element inspection
  - `scripting` — needed to inject the inspector and React bridge content scripts
  - `contextMenus` — needed for right-click "Inspect with Claude" context menu
  - `storage` — needed to persist inspected element state across panel opens
  - `tabs` — needed to track active tab changes and clean up per-tab state
  - `sidePanel` — needed to render the side panel UI
  - `<all_urls>` (host permission) — needed because users inspect elements on any website

### Production build
- [x] Run `npm run build` and verify output in `apps/extension/dist/`
- [x] Confirm no source maps are included in the dist (avoid leaking a source)
- [x] Confirm all icons are present: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
- [ ] Load the dist as an unpacked extension and do a full end-to-end test
- [ ] Test on at least three different websites (React app, plain HTML, complex SPA)

### Required Extension store assets
- [x] **Icon** — 128×128 PNG (already have)
- [ ] **Screenshots** — 1–5 screenshots, exactly 1280×800 or 640×400 px
  - Screenshot 1: Extension panel opens with an element inspected
  - Screenshot 2: Claude responding in the terminal with context
  - Screenshot 3: Disconnected state showing the connect command
- [ ] **Promo tile (small)** — 440×280 PNG — shown in search results
- [ ] **Promo tile (marquee)** — 1400×560 PNG — shown on featured placements
- [x] **Privacy policy URL** — `https://digital-flowers.github.io/claude-code-inspect/privacy-policy`

### Privacy policy
- [x] Written at `docs/privacy-policy.md`
- [ ] Enable GitHub Pages on the repo:
  1. Go to **Settings → Pages** in the GitHub repo
  2. Set source to **Deploy from a branch**, branch `main`, folder `/docs`
  3. Save — the policy will be live at `https://digital-flowers.github.io/claude-code-inspect/privacy-policy`

### Archive
- [x] Zip script at `scripts/zip-extension.ts` — outputs `releases/claude-code-inspect-v{version}.zip`
  ```bash
  bun run zip          # zip existing dist
  bun run build:zip    # full build + zip in one shot
  ```
- [x] `manifest.json` confirmed at zip root level

---

## Phase 2: Chrome Web Store submission

- [ ] Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [ ] Pay a one-time $ 5 developer registration fee (if not already paid)
- [ ] Create new item and upload zip from `releases/`
- [ ] Fill in the store listing:
  - **Name**: Claude Code Inspect
  - **Summary**: (132 chars max) Click any element and send its (full context, selector, component, screenshot) straight to your active Claude Code session.
  - **Description**: (see marketing.md for full copy)
  - **Category**: Developer Tools
  - **Language**: English
- [ ] Add privacy policy URL: `https://digital-flowers.github.io/claude-code-inspect/privacy-policy`
- [ ] Add screenshots and promo tiles
- [ ] Set visibility to **Public**
- [ ] Submit for review — typical review time: 1–3 business days

---

## Phase 3: Post-launch

- [ ] Monitor reviews and respond promptly
- [ ] Set up a GitHub issue template for bug reports from extension users
- [ ] Plan v1.1 based on early feedback
- [ ] Consider Firefox / Edge ports in a future phase