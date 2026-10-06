---
description: Scan for secrets, push to GitHub, deploy GitHub Pages via Actions, update README and repo About
argument-hint: <github repo URL or owner/repo>
---

Publish this project to GitHub and GitHub Pages. Target repo: `$ARGUMENTS`

If `$ARGUMENTS` is empty, ask the user for the GitHub repo URL (or `owner/repo`) and stop until they answer. Normalise the input to `OWNER/REPO` and `https://github.com/OWNER/REPO.git`. The Pages URL is `https://OWNER.github.io/REPO/` (or `https://OWNER.github.io/` when REPO is `OWNER.github.io`).

Work through the steps in order. The secret scan runs **before** anything is pushed. Report each step's outcome as you go, and stop on any failure instead of working around it.

## 1. Scan for sensitive data (blocking)

Scan every file that would be committed: `git ls-files` plus untracked, non-ignored files (`git ls-files --others --exclude-standard`), or all files when this is not yet a git repo. Look for:

- Private keys and certs: `-----BEGIN .*PRIVATE KEY-----`, `.pem`, `.key`, `.p12`, `.pfx`, `id_rsa*`
- Tokens and keys: `ghp_`, `gho_`, `github_pat_`, `sk-`, `sk-ant-`, `AKIA[0-9A-Z]{16}`, `AIza`, `xox[abpr]-`, Stripe `sk_live_`/`rk_live_`, JWTs (`eyJ...\.eyJ...`)
- Assignments such as `password|passwd|secret|api[_-]?key|token|client_secret\s*[:=]\s*['"][^'"]{6,}`
- Connection strings with embedded credentials (`://user:pass@`)
- Files that should never be committed: `.env*` (except `.env.example`), `*.sqlite`/`*.db` dumps, `credentials*.json`, `.npmrc`/`.pypirc` containing auth, and `.claude/settings.local.json`
- Real personal email addresses or phone numbers hard-coded in source. Placeholders like `YOUR_EMAIL@example.com` are fine. Flag any real address in config constants (e.g. `FORMSUBMIT_ENDPOINT`) and ask the user whether it is meant to be public.

If this is an existing repo with history, also run `git log -p --all` through the same patterns, because a secret removed from the working tree is still published by history.

If anything is found, list each finding as `file:line` with the secret partly masked (never print a full secret). Then **stop and ask the user** how to proceed. Do not push. Suggest moving the value to an ignored file, adding a `.gitignore` entry, and rotating any credential that was already pushed.

Make sure a `.gitignore` exists covering at least `.env*`, `!.env.example`, `.claude/settings.local.json`, `node_modules/`, `.DS_Store`, `Thumbs.db` and `_site/`. Add the missing entries.

## 2. Upload the code to GitHub

- If this is not a git repo, run `git init -b main`.
- If `git config user.name` / `user.email` are unset, ask the user what to use and set them **repo-locally** only (never `--global`).
- Set `origin` to the target URL: add it if missing; if it points elsewhere, show both URLs and ask before changing it.
- Stage files by explicit path or `git add -A` only after step 1 passed. Show `git status --short` before committing.
- Commit with a descriptive message, then `git push -u origin <current branch>`. If the remote has commits the local branch lacks, `git pull --rebase` and retry. **Never force-push** unless the user explicitly asks.

## 3. Create or edit the GitHub Pages workflow

Create `.github/workflows/pages.yml`, or update it if it exists, keeping any custom build steps. It uses the official Actions flow:

- triggers: `push` to the default branch, plus `workflow_dispatch`
- permissions: `contents: read`, `pages: write`, `id-token: write`; `concurrency: group: pages`
- steps: `actions/checkout@v4` → build or stage the site into `_site/` → `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3` (path `_site`) → `actions/deploy-pages@v4` with `environment: github-pages`

Decide how to stage the site from the project:

- **Plain static site** (e.g. `index.html` at the root with no `package.json`): copy only the publishable files (HTML/CSS/JS/assets) into `_site/` and add `_site/.nojekyll`. Never copy `.claude/`, `.github/`, `CLAUDE.md` or dotfiles.
- **Project with a build step**: install dependencies and run the build in the workflow, then upload the build output directory.

Commit and push the workflow.

## 4. Create or edit the README

Write `README.md`, or update it if it exists, keeping any sections the user wrote. Base it on what the code actually does. Include:

- the project name and a one-paragraph description
- a **Live demo** link to the Pages URL
- features, drawn from the code
- how to run it locally
- configuration the user must change (for example config constants and their activation or setup steps)
- deployment: a note that pushes to the default branch deploy via GitHub Actions
- a tech stack line

Keep it accurate. Do not invent features, badges, licences or contribution policies. Commit and push.

## 5. Enable Pages and update the repo About

Use the GitHub API. Prefer `gh` if it is installed and authenticated (`gh auth status`). Otherwise, get a token from git's credential helper **without printing it**:

```sh
TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | sed -n 's/^password=//p')
```

and call `https://api.github.com` with `curl -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json"`. Never echo, log or write the token to a file.

1. **Enable Pages with Actions as the source.** First `GET /repos/OWNER/REPO/pages`. On 404, `POST /repos/OWNER/REPO/pages` with `{"build_type":"workflow"}`. If it exists with a different `build_type`, `PUT` it with `{"build_type":"workflow"}`. Do this before or right after pushing the workflow; if the first run failed because Pages was not enabled, re-run it (`POST /repos/OWNER/REPO/actions/workflows/pages.yml/dispatches` with `{"ref":"<branch>"}`).
2. **Update the About section.** `PATCH /repos/OWNER/REPO` with:
   - `description`: a one-line summary of the project (≤ 350 chars, taken from the README)
   - `homepage`: the Pages URL
   - Also `PUT /repos/OWNER/REPO/topics` with `{"names":[...]}`: a few relevant lowercase topics (e.g. language, project type). Merge with existing topics; don't drop them.

If the token lacks permission (403/404 on a repo you can push to), tell the user exactly which setting to change by hand: **Settings → Pages → Source: GitHub Actions**, and the ⚙ next to **About** on the repo page.

## 6. Verify the deployment

- Poll `GET /repos/OWNER/REPO/actions/runs?per_page=1` until the latest run completes (time out after ~8 minutes). Report the `conclusion`. On failure, fetch the failed job's log, and fix and re-push if the cause is in the workflow.
- Check that the Pages URL returns HTTP 200 (allow a minute after deploy for propagation).
## 7. Capture a screenshot and add it to the README

Use the **Playwright MCP** server (`playwright` in `.mcp.json`). If its `browser_*` tools are not available in this session, tell the user to reload the window and approve the `playwright` server, then skip this step. Do not swap in another screenshot method without asking.

1. `browser_navigate` to the live Pages URL. If the page isn't live yet (first publish), use the local `file:///<absolute path>/index.html` instead.
2. `browser_resize` to 1440×900 and wait until the main content has rendered (`browser_snapshot` or `browser_wait_for` on visible text).
3. `browser_take_screenshot` (PNG, viewport, not full page). Move or copy the file the tool reports into `docs/screenshot.png`, replacing any existing one.
4. Open the PNG to check it shows the real page (not blank, an error page or a cookie banner). Then `browser_close`.
5. In `README.md`, add or replace a `![<Project name> screenshot](docs/screenshot.png)` line directly under the **Live demo** link. Never add a second screenshot line.
6. Make sure `.playwright-mcp/` is in `.gitignore`. Re-run the step 1 scan on the new files (the screenshot must not show secrets or personal data). Then commit `docs/screenshot.png` and `README.md` and push. Confirm that the Pages run this push triggers also succeeds.

## 8. Report

- Finish with a short summary: the repo URL, the **live Pages URL**, the commits pushed, scan results (clean, or what was flagged and how it was resolved), whether the screenshot was added, and anything the user still has to do by hand.
