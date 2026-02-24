# Repo Architecture — habeas_patches

## Overview

The Amino Habeas app is split across two GitHub repos:

| Repo | Purpose |
|---|---|
| `clovenbradshaw-ctrl/habeas_app` | The **stable launcher** — minimal bootstrap served to users. Rarely changes. |
| `clovenbradshaw-ctrl/habeas_patches` | The **app code** — where all real development happens. This repo. |

The running app at `app.aminoimmigration.com` is served from `habeas_app`, but the actual application logic lives here in `habeas_patches`. `habeas_app` loads a specific **versioned copy** of `app.js` from `habeas_patches` — and which version it loads is controlled by a **Matrix state event** in the `!org` room.

---

## How Versioning Works

```
habeas_app (stable bootstrap)
    │
    │  on load: reads Matrix !org room
    │  for state event: com.amino.config.version
    │  { sha: "abc1234", repo: "clovenbradshaw-ctrl/habeas_patches" }
    │
    ▼
loads app.js from habeas_patches at that exact SHA
(e.g. via jsDelivr CDN or raw.githubusercontent.com)
    │
    ▼
Users see that version of the app
```

When admin approves an update:
1. The Matrix state event `com.amino.config.version` is updated to the new SHA
2. All users loading the page get the new version immediately — no redeployment of `habeas_app` needed
3. Rollback = update the Matrix state event back to any prior SHA

**`habeas_app` itself does not change.** It is just a loader. All feature work, bug fixes, and improvements happen in `habeas_patches`.

---

## Files in This Repo

```
habeas_patches/
├── index.html          ← Standalone dev/test entrypoint (not served to users in production)
├── app.js              ← Entire application (~6700 lines, vanilla JS, no build step)
├── styles.css          ← All styles
├── deploy-info.js      ← Version metadata (see below)
├── courts.json         ← Seed data for courts (initial setup only)
├── facilities.json     ← Seed data for facilities (initial setup only)
├── template.html       ← Petition document template
├── favicon.svg         ← App icon
├── CLAUDE.md           ← Full system architecture (Matrix rooms, data model, event types)
└── REPO_ARCHITECTURE.md  ← This file
```

**`app.js` is the whole app.** There's no build step, no npm, no React. It's vanilla JS that calls the Matrix REST API directly. Read `CLAUDE.md` for the full data model.

**`index.html` is for local development only.** In production, `habeas_app` provides the HTML wrapper that loads `app.js` from `habeas_patches` at a pinned SHA.

---

## deploy-info.js

This file provides version metadata that the running app uses to display the current version and power the deploy panel.

```js
var DEPLOY_INFO = {
  sha: "abc1234...",       // full commit SHA (this version of app.js)
  shortSha: "abc1234",     // 7-char abbreviated SHA shown in nav badge
  timestamp: "2026-...",   // when this version was approved/deployed
  message: "Fix petition export", // commit message
  author: "clovenbradshaw-ctrl",
  prNumber: "42",          // PR number if relevant
  env: "production",       // "production" | "development"
  repo: "clovenbradshaw-ctrl/habeas_patches",
};
```

In local dev, `deploy-info.js` has `env: "development"` and `sha: "local"`. The app shows a **DEV badge** in this state.

---

## Admin Deploy Panel

The deploy panel lives at **Admin → Deploy** and is only visible to `role: "admin"` users.

It connects to the GitHub API using a **Personal Access Token stored in Matrix** — specifically as a state event in the `!org` room (`com.amino.config.github` or similar). This means:
- Admin saves the token once in the deploy panel
- It syncs to all admin sessions automatically via Matrix
- No per-browser or per-device configuration needed

### What the panel does

1. **View pending commits** — commits merged to `main` in `habeas_patches` that aren't yet the active version
2. **Review diff** — file-by-file changes between the currently active SHA and `main`
3. **Approve + go live** — updates the Matrix `!org` state event to point to the new SHA → all users immediately load the new version
4. **Rollback** — updates the Matrix state event to any prior SHA → instant revert for all users

### No GitHub Actions required

Because the "deploy" is just updating a Matrix state event, there's no GitHub Actions pipeline, no build step, and no branch push involved. The version pointer lives in Matrix, not in any repo file.

---

## Dev Badge

When `DEPLOY_INFO.env !== "production"` the app shows a **DEV badge** in the navigation. This happens:
- During local development (`env: "development"`, `sha: "local"`)
- If `habeas_app` loads a version of `app.js` that hasn't been marked as production-approved

The DEV badge is visible to all logged-in users so attorneys know they're not on the live version.

---

## Developer Workflow

### For Claude Code / developers pushing updates

1. **Branch from `main`** — name branches descriptively (`fix/petition-export-date`, `feat/template-picker`)
2. **Edit `app.js` and/or `styles.css`** — no build step, test by opening `index.html` locally
3. **Open a PR to `main`** — describe what changed and why
4. **Merge to `main`** — this does NOT go live yet; it just makes the commit available for admin review

### Branch naming (Claude Code sessions)

Claude Code branches follow: `claude/<description>-<sessionId>`

These are reviewed and merged by a human. The admin then decides when (and whether) to make the new version live via the deploy panel.

### Never do this

- Don't store secrets (PAT tokens, passwords) in this repo — they live in Matrix state
- Don't push directly to `habeas_app` unless changing the bootstrap loader itself (rare)
- Don't merge substantial changes to `main` without a PR review

---

## Summary

```
Developer / Claude Code
        │
        │  feature branch → PR → merge to main
        ▼
  habeas_patches/main
  (code is available but not yet live)
        │
        │  Admin opens Deploy panel
        │  reviews pending commits + diff
        │  clicks "Approve & Go Live"
        ▼
  Matrix !org room state event updated:
  com.amino.config.version { sha: "new-sha" }
        │
        ▼
  habeas_app bootstrap reads new SHA on next user load
  → serves app.js from habeas_patches@new-sha via CDN
        │
        ▼
  All users see the update immediately

  (Rollback = same thing, pointing SHA back to any prior commit)
```

The key insight: **`habeas_app` never changes.** It's a thin loader. All development happens here. The "deploy" is a Matrix state event update, giving the admin instant, atomic control over what version every user sees — with full rollback capability to any prior merge.
