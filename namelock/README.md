# 🧠 NameLock — Name Memory Trainer

A personal Progressive Web App that locks names into memory by breaking a name into
syllables and linking them to a person's most distinctive facial feature — using
classic memory-palace / name-face association techniques. Powered by Claude.

Install it to your phone's home screen and it runs like a native app.

---

## What you need

- A free [GitHub](https://github.com) account
- An **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com) → *API Keys*.
  (You add the key inside the app on your phone — it is **never** stored in this repo.)

---

## Deploy it (about 5 minutes)

### 1. Put these files in a GitHub repo
- On GitHub, click **New repository**, name it e.g. `namelock`, make it **Public**, and create it.
- Upload every file in this folder (keep the structure — `src/`, `public/`, `.github/`).
  Easiest in the browser: **Add file → Upload files**, then drag the whole folder in.
  (Or use git: `git init && git add . && git commit -m "init" && git remote add origin <your-repo-url> && git push -u origin main`)

### 2. Turn on GitHub Pages
- In the repo: **Settings → Pages**.
- Under **Build and deployment → Source**, choose **GitHub Actions**.

### 3. Let it build
- Go to the **Actions** tab. A workflow called *Deploy NameLock to GitHub Pages* runs automatically on every push.
- When it finishes (green check), your app is live at:
  **`https://<your-username>.github.io/<repo-name>/`**

> The build figures out the correct path automatically — no file editing needed.

---

## Install on your phone

Open the live URL in your phone's browser, then:

**iPhone (Safari):** tap the **Share** button → **Add to Home Screen**.
**Android (Chrome):** tap the **⋮** menu → **Install app** / **Add to Home screen**.

It now has its own icon and opens full-screen, no browser bars.

---

## First run

1. Open the app → tap the **⚙ Settings** gear (top right).
2. Paste your Anthropic API key → **Save Settings**.
3. Go to **Create**, type a name, pick a facial feature, and generate your memory hook.

Your key and your saved name library live **only on your device** (browser storage).
Clearing your browser data or your phone's site data will erase them.

---

## Local development (optional)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

---

## How it works & costs

- Each memory hook is one short Claude request (typically well under a cent on Sonnet).
- The app calls the Anthropic API directly from your browser using the official
  `anthropic-dangerous-direct-browser-access` header. This is fine for personal use,
  but it means your key is present in your own browser — only install this on a device you control,
  and don't share your deployed link together with your key.
- To change the model, edit it in **Settings**.
