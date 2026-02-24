# Repo Architecture — habeas_patches

## Overview

The Amino Habeas app is split across two GitHub repos:

| Repo | Purpose |
|---|---|
| `clovenbradshaw-ctrl/habeas_app` | **Bootstrap only** — login screen + version loader. Rarely changes. |
| `clovenbradshaw-ctrl/habeas_patches` | **The app** — all real development happens here. This repo. |

`habeas_app` serves a static page with the login form hardcoded. After a user logs in, it reads a Matrix state event (`com.amino.config.version`) from the `!org` room that says which SHA of `habeas_patches` to load. It then dynamically loads `app.js` from the jsDelivr CDN at that exact SHA. The full app takes over from there.

**Everything beyond the login screen lives in this repo (`habeas_patches`).** The admin controls which version users see via the Deploy panel inside the app — no GitHub Actions required.

---

## How Versioning Works

```
habeas_app (login screen + tiny bootstrap)
    │
    │  User logs in (credentials sent to Matrix)
    │  Bootstrap reads Matrix !org room state event:
    │    com.amino.config.version { sha: "abc1234...", repo: "...habeas_patches" }
    │
    ▼
Loads from jsDelivr CDN at that exact SHA:
  https://cdn.jsdelivr.net/gh/clovenbradshaw-ctrl/habeas_patches@abc1234/app.js
  https://cdn.jsdelivr.net/gh/clovenbradshaw-ctrl/habeas_patches@abc1234/styles.css
    │
    ▼
Full app runs. Users see that version.
```

When admin approves an update (via Admin → Deploy panel inside the app):
1. App calls Matrix API: updates `com.amino.config.version` state event in `!org` room with new SHA
2. No GitHub Actions triggered. No redeployment needed.
3. All new page loads immediately get the new version via CDN.
4. Rollback = update the Matrix state event to any prior SHA. Instant.

**`habeas_app` itself does not change.** It is a loader. All feature work happens here.

---

## Files in This Repo

```
habeas_patches/
├── app.js              ← The entire application (~6700 lines, vanilla JS, no build step)
├── styles.css          ← All styles
├── deploy-info.js      ← Version metadata (auto-updated by GitHub Actions on merge to main)
├── index.html          ← Local development entry point only (not used in production)
├── courts.json         ← Seed data for courts (initial setup only)
├── facilities.json     ← Seed data for facilities (initial setup only)
├── template.html       ← Petition document template
├── favicon.svg         ← App icon
├── CLAUDE.md           ← Full system architecture (Matrix rooms, data model, event types)
├── REPO_ARCHITECTURE.md  ← This file
└── .github/workflows/
    └── stamp-deploy-info.yml  ← Auto-stamps deploy-info.js on every merge to main
```

**`app.js` is the whole app.** No build step. No npm. Vanilla JS calling Matrix REST API directly.

**`index.html` is for local development only.** Open it in a browser to test changes locally.
In production, `habeas_app` provides the HTML wrapper.

---

## deploy-info.js

This file is automatically updated by GitHub Actions on every merge to `main`. It embeds the exact commit SHA, message, author, and timestamp so any version of `app.js` served via CDN knows its own identity.

```js
var DEPLOY_INFO = {
  sha: "abc1234...",        // full commit SHA
  shortSha: "abc1234",      // 7-char abbreviated SHA shown in nav
  timestamp: "2026-...",    // when this commit landed on main
  message: "Fix petition export date",
  author: "clovenbradshaw-ctrl",
  prNumber: "42",           // PR number if present in commit message
  env: "production",        // "production" | "development"
  repo: "clovenbradshaw-ctrl/habeas_patches",
};
```

In local dev (`index.html`), `deploy-info.js` has `env: "development"` and `sha: "local"`. The app shows a **DEV badge** in this state.

---

## Admin Deploy Panel

The deploy panel lives at **Admin → Deploy** and is only visible to `role: "admin"` users.

It connects to GitHub using a **Personal Access Token stored in Matrix** — as a state event in the `!org` room (`com.amino.config.github`). Admins save the token once; it syncs to all admin sessions automatically.

### What it does

1. **View pending commits** — fetches commit history from `habeas_patches/main` via GitHub API, highlights commits newer than the currently approved SHA
2. **Review diff** — shows file-by-file changes between live SHA and `main`
3. **Approve + go live** — calls `matrix.sendStateEvent(orgRoom, "com.amino.config.version", { sha, ... })` — updates the version pointer for all users instantly
4. **Rollback** — same Matrix state event update, pointing to any prior SHA

### No GitHub Actions for deploy

The "deploy" is just updating a Matrix state event. It requires:
- GitHub PAT with `repo` scope (to read commit history and diffs via GitHub API)
- Admin power level in Matrix `!org` room (to write state events)

No `workflow_dispatch`, no branch push, no GitHub Pages rebuild.

---

## Developer Workflow

### Making changes (via Claude Code or directly)

1. Branch from `main` with a descriptive name:
   - Claude Code branches: `claude/<description>-<sessionId>`
   - Manual branches: `fix/petition-export-date`, `feat/template-picker`, etc.
2. Edit `app.js` and/or `styles.css`
3. Test locally by opening `index.html` in a browser
4. Open a PR to `main`
5. Merge the PR

**Merging to `main` does NOT go live yet.** The GitHub Action runs and updates `deploy-info.js` with the new SHA. The commit is now available for admin review.

### Admin approval

1. Open the app at `app.aminoimmigration.com`
2. Go to **Admin → Deploy**
3. Click **Refresh** to see pending commits
4. Click **Review Changes** → review the file diff
5. Check "I have reviewed and approve" → click **Deploy to Production**
6. The Matrix `com.amino.config.version` state event is updated
7. All new page loads get the new version. No one needs to be notified.

### Rollback

In **Admin → Deploy → Version History**, click **Deploy** next to any previous commit. Done.

---

## One-Time Setup

### 1. habeas_patches (this repo)

- Enable GitHub Pages: **Settings → Pages → Source → GitHub Actions** (even though we don't actually use Pages for anything — this just prevents accidental auto-deploys)
- The `stamp-deploy-info.yml` workflow will auto-run on the next push to `main`

### 2. habeas_app

Replace `habeas_app/index.html` with the bootstrap below. This is the only change needed to `habeas_app`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Habeas — Amino Immigration</title>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=JetBrains+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    /* Minimal login shell — only shown until app.js loads */
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: 'DM Sans', sans-serif; background: #0f0f12; color: #e8e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    #boot-shell { width: 360px; }
    #boot-logo { text-align: center; margin-bottom: 32px; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    #boot-logo span { color: #a08540; }
    .boot-field { margin-bottom: 16px; }
    .boot-field label { display: block; font-size: 13px; color: #888; margin-bottom: 6px; }
    .boot-field input { width: 100%; padding: 10px 12px; background: #1a1a20; border: 1px solid #2a2a35; border-radius: 6px; color: #e8e8f0; font-size: 15px; outline: none; }
    .boot-field input:focus { border-color: #a08540; }
    #boot-submit { width: 100%; padding: 11px; background: #a08540; color: #fff; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; }
    #boot-submit:disabled { opacity: 0.6; cursor: default; }
    #boot-error { margin-top: 12px; padding: 10px 12px; background: #2a1010; border: 1px solid #6b2020; border-radius: 6px; font-size: 13px; color: #f87171; display: none; }
    #boot-status { margin-top: 12px; font-size: 13px; color: #888; text-align: center; min-height: 20px; }
  </style>
</head>
<body>
  <div id="boot-shell">
    <div id="boot-logo">Amino <span>Habeas</span></div>
    <form id="boot-form">
      <div class="boot-field">
        <label for="boot-user">Username</label>
        <input id="boot-user" type="text" autocomplete="username" required />
      </div>
      <div class="boot-field">
        <label for="boot-pass">Password</label>
        <input id="boot-pass" type="password" autocomplete="current-password" required />
      </div>
      <button id="boot-submit" type="submit">Sign In</button>
      <div id="boot-error"></div>
      <div id="boot-status"></div>
    </form>
  </div>

  <!-- CDN deps loaded after login so they don't slow the login screen -->
  <script>
  (function() {
    var MATRIX_URL = 'https://matrix.aminoimmigration.com';
    var ORG_ALIAS  = '#org:aminoimmigration.com';
    var PATCHES_REPO = 'clovenbradshaw-ctrl/habeas_patches';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + PATCHES_REPO;

    var form   = document.getElementById('boot-form');
    var submit = document.getElementById('boot-submit');
    var errEl  = document.getElementById('boot-error');
    var status = document.getElementById('boot-status');

    function setStatus(msg) { status.textContent = msg; }
    function setError(msg)  { errEl.textContent = msg; errEl.style.display = 'block'; }
    function clearError()   { errEl.style.display = 'none'; }

    function api(method, path, body, token) {
      var opts = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
      };
      if (token) opts.headers['Authorization'] = 'Bearer ' + token;
      if (body)  opts.body = JSON.stringify(body);
      return fetch(MATRIX_URL + '/_matrix/client/v3' + path, opts)
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, status: r.status, data: d }; }); });
    }

    function loadScript(src) {
      return new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function() { reject(new Error('Failed to load: ' + src)); };
        document.head.appendChild(s);
      });
    }

    function loadCSS(href) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      clearError();
      var user = document.getElementById('boot-user').value.trim();
      var pass = document.getElementById('boot-pass').value;
      submit.disabled = true;
      setStatus('Signing in...');

      api('POST', '/login', { type: 'm.login.password', user: user, password: pass })
        .then(function(res) {
          if (!res.ok || !res.data.access_token) {
            throw new Error(res.data.error || res.data.errcode || 'Login failed');
          }
          var token = res.data.access_token;
          var userId = res.data.user_id;
          var deviceId = res.data.device_id;

          // Persist session for app.js to pick up
          sessionStorage.setItem('mx_access_token', token);
          sessionStorage.setItem('mx_user_id', userId);
          sessionStorage.setItem('mx_device_id', deviceId);

          setStatus('Checking approved version...');

          // Resolve org room alias
          return api('GET', '/directory/room/' + encodeURIComponent(ORG_ALIAS), null, token)
            .then(function(aliasRes) {
              if (!aliasRes.ok) throw new Error('Could not find org room');
              var roomId = aliasRes.data.room_id;

              // Read version state event — which SHA should users load?
              return api('GET', '/rooms/' + encodeURIComponent(roomId) + '/state/com.amino.config.version/', null, token)
                .then(function(verRes) {
                  // Use approved SHA if set; fall back to latest main
                  var sha = (verRes.ok && verRes.data && verRes.data.sha) ? verRes.data.sha : 'main';
                  return sha;
                });
            });
        })
        .then(function(sha) {
          setStatus('Loading app (' + sha.substring(0, 7) + ')...');
          var base = CDN_BASE + '@' + sha;

          // Load CDN deps, then styles, then deploy-info, then app.js
          return loadScript('https://cdn.jsdelivr.net/npm/flatpickr')
            .then(function() { return loadScript('https://cdn.jsdelivr.net/npm/docx@9.5.3/build/index.umd.js'); })
            .then(function() {
              loadCSS('https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css');
              loadCSS(base + '/styles.css');
              return loadScript(base + '/deploy-info.js');
            })
            .then(function() { return loadScript(base + '/app.js'); });
        })
        .then(function() {
          // app.js has taken over — remove the boot shell
          document.getElementById('boot-shell').remove();
        })
        .catch(function(err) {
          submit.disabled = false;
          setStatus('');
          setError(err.message || 'An error occurred');
        });
    });

    // If already logged in (session in sessionStorage), skip login and load directly
    var savedToken = sessionStorage.getItem('mx_access_token');
    if (savedToken) {
      submit.disabled = true;
      setStatus('Restoring session...');
      api('GET', '/directory/room/' + encodeURIComponent(ORG_ALIAS), null, savedToken)
        .then(function(aliasRes) {
          if (!aliasRes.ok) { sessionStorage.clear(); location.reload(); return; }
          var roomId = aliasRes.data.room_id;
          return api('GET', '/rooms/' + encodeURIComponent(roomId) + '/state/com.amino.config.version/', null, savedToken)
            .then(function(verRes) {
              return (verRes.ok && verRes.data && verRes.data.sha) ? verRes.data.sha : 'main';
            });
        })
        .then(function(sha) {
          setStatus('Loading app (' + sha.substring(0, 7) + ')...');
          var base = CDN_BASE + '@' + sha;
          return loadScript('https://cdn.jsdelivr.net/npm/flatpickr')
            .then(function() { return loadScript('https://cdn.jsdelivr.net/npm/docx@9.5.3/build/index.umd.js'); })
            .then(function() {
              loadCSS('https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css');
              loadCSS(base + '/styles.css');
              return loadScript(base + '/deploy-info.js');
            })
            .then(function() { return loadScript(base + '/app.js'); })
            .then(function() { document.getElementById('boot-shell').remove(); });
        })
        .catch(function() {
          sessionStorage.clear();
          submit.disabled = false;
          setStatus('');
        });
    }
  })();
  </script>
  <!-- Containers app.js expects to exist in the DOM -->
  <div id="root"></div>
  <div id="toast-container" class="toast-container" role="status" aria-live="polite"></div>
</body>
</html>
```

### 3. First-time version pointer

After `habeas_app` is deployed with the new bootstrap, the first page load will fall back to `sha: "main"` because no version state event exists yet. Once the admin logs in and sets the version via **Admin → Deploy → Deploy to Production**, subsequent loads will use the pinned SHA.

To seed the version pointer without going through the app, run this (replace values):

```bash
# Seed the initial version pointer directly via Matrix REST API
curl -X PUT "https://matrix.aminoimmigration.com/_matrix/client/v3/rooms/ROOM_ID/state/com.amino.config.version/" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sha": "FULL_SHA_FROM_HABEAS_PATCHES",
    "shortSha": "SHORT_SHA",
    "message": "Initial production version",
    "author": "admin",
    "timestamp": "2026-01-01T00:00:00Z",
    "repo": "clovenbradshaw-ctrl/habeas_patches",
    "env": "production"
  }'
```

Or just load the app once (it will use `main`) and immediately go to **Admin → Deploy → Deploy to Production**.

### 4. GitHub PAT

In the app, go to **Admin → Deploy → GitHub Access** and enter a GitHub Personal Access Token with `repo` scope. This allows the deploy panel to fetch commit history and diffs from `habeas_patches`. The token is stored in Matrix (not the browser) and shared across all admin sessions.

---

## Summary Flow

```
Developer / Claude Code
        │
        │  feature branch → PR → merge to main
        ▼
  habeas_patches/main
  (GitHub Action auto-stamps deploy-info.js with SHA metadata)
  (commit is available at CDN but NOT yet live)
        │
        │  Admin opens Admin → Deploy in the running app
        │  Reviews pending commits + file diff
        │  Clicks "Deploy to Production"
        ▼
  Matrix !org room state updated:
  com.amino.config.version { sha: "new-sha", ... }
        │
        ▼
  habeas_app bootstrap reads new SHA on next user load
  → loads app.js + styles.css from jsDelivr @ new-sha
        │
        ▼
  All users see the update on their next page load.
  Currently open sessions get a "reload to update" toast.

  Rollback: same flow — admin picks any prior SHA → updates Matrix state → instant.
```

---

## What Never Changes

- `habeas_app` stays static. The bootstrap HTML is a one-time setup.
- `habeas_patches` is the only repo developers (human or Claude Code) need to touch.
- Secrets (PAT tokens, Matrix credentials) are never committed anywhere — they live in Matrix state events or sessionStorage.
