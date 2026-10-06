# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file IT PMO Kanban board (`index.html`) for a fictitious bank's internal demo/training use. All markup, CSS (`<style>`) and JS (`<script>`) live in that one file, and it must keep running by double-clicking it (`file://`, no server).

## Hard constraints (from the original spec — do not violate)

- Vanilla HTML/CSS/JS only: no frameworks, libraries, build step, bundler or npm.
- No external resources: no CDNs, web fonts or image files. Use the system font stack and inline SVG/Unicode for icons.
- **No persistence**: no localStorage, sessionStorage, IndexedDB or cookies. A refresh resets to the seed data, which is intended (the UI has a note saying so).
- The only network call is FormSubmit's AJAX endpoint. A FormSubmit failure must never break the board.
- Branding: use a neutral "IT PMO" wordmark and the corporate blue palette defined as `:root` tokens (every text pair checked to WCAG AA contrast; keep it that way). Do not use a real bank's logo or imitate an official system. Task IDs use the spec-mandated `UOB-ITPM-####` format (`ID_PREFIX`).
- CSS: use custom properties on `:root` for colours and spacing. No `!important`.

## Commands

There is no build, lint or test tooling. To run the app, open `index.html` in a browser.

**After any edit to the inline `<script>` or `<style>` block, you must update the CSP hashes**. If you don't, the browser blocks the edited block and the page breaks silently:

```sh
node scripts/csp-hash.mjs          # rewrite the script-src / style-src hashes in index.html
node scripts/csp-hash.mjs --check  # verify (the Pages workflow runs this and fails the deploy if stale)
node -e "const h=require('fs').readFileSync('index.html','utf8');new Function(h.match(/<script>([sS]*?)</script>/)[1]);console.log('ok')"   # syntax check
```

The page must contain exactly one `<script>` and one `<style>` element. Don't write those literal tags inside HTML comments, because the hash script matches on them. Don't add inline `style=""` attributes or `on*=` handlers either: the CSP blocks them. Set styles from JS through the `element.style` property instead; the charts do this with `data-pct` and `data-grow`.

**Trusted Types is enforced.** Write HTML only through `setHTML(el, html)`. Raw `innerHTML`/`insertAdjacentHTML`, `script.textContent`, or creating any other Trusted Types policy will throw. Use `textContent` for plain text.

Playwright MCP blocks `file:` URLs. To test in a browser, serve the folder over `http://127.0.0.1` with any static server.

## Architecture (inside the `<script>` block)

- **Startup**: `init()` first calls `refuseIfFramed()`, a clickjacking defence that replaces the page with an "open in a new tab" link when framed. It then binds the security monitor, seeds the tasks and renders.
- **Single source of truth**: `state = { tasks, filters, ui, activity, notify, nextId }`. `state.ui` holds transient UI: `moveMenuId` (open "Move ▸" menu), `confirmDeleteId` (inline "Delete? Yes / No") and `dragId` (the card currently being dragged). `state.activity` is the in-memory audit log, written via `logActivity()` by every mutation. `state.notify` tracks email rate limiting. `logActivity(text, { security: true })` marks security events, which come from the `securitypolicyviolation` listener and the honeypot.
- **Render from state only**: mutations go through `addTask()`, `moveTask()` and `deleteTask()`, then call `renderBoard()`. `renderBoard()` rebuilds each column's list from `renderCard()` HTML strings, sorted by `sortTasks()`. It also updates the WIP indicators (`WIP_LIMITS`) and calls `renderSummary()` (header strip), `renderAnalytics()` and `renderActivity()`.
- **Board Analytics**: `computeAnalytics()` is pure over all tasks (it ignores the filters). `renderAnalytics()` draws the KPI cards, the status stacked bar, the bar rows and the table view. Bar rows with a `filter` are buttons carrying `data-filter-key`/`data-filter-value`; clicking one toggles that board filter, and `renderBoard()` restores focus to it. Chart colours are `--series-*` tokens (one per column, shared with the column accents) and `--due-*` tokens, validated with the dataviz validator. Keep that fixed order and keep the direct labels and table view, because two of the slots are below 3:1 contrast.
- **Card ageing**: tasks carry `statusSince` (`YYYY-MM-DD`), reset in `addTask()`/`moveTask()`. `daysInColumn()` feeds the card label, the "Longest in column" sort and the average-age KPI. Do not mutate card contents anywhere else. The only DOM changes outside it are the drag/drop highlight classes and toasts.
- **Focus restoration**: re-rendering replaces card DOM, so interactive card controls carry `data-focus-key`. `renderBoard(focusKey)` focuses that key afterwards, or restores the previously focused key. Keep this pattern when adding card controls, or keyboard users lose focus.
- **Event delegation**: one click listener on `#board` dispatches on `data-action` (`toggle-move`, `move`, `ask-delete`, `cancel-delete`, `confirm-delete`). Escape closes open menus. HTML5 drag-and-drop is also delegated on `#board`, keyed by `.column[data-status]`. Drops are honoured only when `state.ui.dragId` is set, meaning the drag started on one of the board's own cards; external drops are ignored.
- **Escaping**: every user-supplied string inserted into HTML must go through `escapeHtml()`.
- **Input hardening** (`readForm`/`validateTask`): free text passes through `sanitizeText()` (NFC normalisation; strips control and bidi-override characters). Then `findSensitiveData()` blocks card numbers (Luhn check), NRIC/FIN-style IDs, secrets, tokens, JWTs and private keys. Due dates must be real dates, not in the past, and at most `LIMITS.maxYearsAhead` years ahead.
- **Filtering**: `applyFilters()` (search query, project, assignee, priority) and `sortTasks()` are pure over `state.tasks`. Column count badges show filtered counts, and the summary strip shows totals over all tasks.
- **Add Task flow** (`handleSubmit`): `validateTask()` produces inline errors via `showFormErrors()` (never `alert()`). It then calls `addTask()` optimistically, resets the form and shows a success toast, then calls `notifyNewTask()` with the submit button in a "Sending…" state. On failure it shows a warning toast and keeps the card.
- **FormSubmit**: `FORMSUBMIT_ENDPOINT` is the one config constant at the top of the script. The address must be activated once via the confirmation email FormSubmit sends on first submission. `notifyNewTask()` treats both non-2xx responses and a `success: "false"` body as failures. `notificationBlockedReason()` enforces the `NOTIFY` limits: the endpoint must start with `https://formsubmit.co/ajax/`, emails are at least 15 s apart, and at most 20 are sent per session. The fetch has a 10 s timeout and uses `credentials: "omit"`, `referrerPolicy: "no-referrer"` and `redirect: "error"`. A filled honeypot field (`website`) means the card is added but no email is sent. If you change the FormSubmit domain, update the CSP `connect-src` as well.
- **Dates**: stored as local `YYYY-MM-DD` strings and compared lexically against `todayISO()`. Seed data uses `addDays()` offsets so the overdue examples stay overdue relative to the current date.
- Fixed enumerations (`STATUSES`, `PRIORITIES`, `PROJECTS`, `CATEGORIES`) drive both the form/filter `<select>` options and validation. The four board columns are static markup whose `data-status` must match `STATUSES`.
