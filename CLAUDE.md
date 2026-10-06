# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file IT PMO Kanban board (`index.html`) for a fictitious bank's internal demo/training use. All markup, CSS (`<style>`) and JS (`<script>`) live in that one file, and it must keep running by double-clicking it (`file://`, no server).

## Hard constraints (from the original spec — do not violate)

- Vanilla HTML/CSS/JS only: no frameworks, libraries, build step, bundler or npm.
- No external resources: no CDNs, web fonts or image files. Use the system font stack and inline SVG/Unicode for icons.
- **No persistence**: no localStorage, sessionStorage, IndexedDB or cookies. A refresh resets to the seed data, which is intended (the UI has a note saying so).
- The only network call is FormSubmit's AJAX endpoint. A FormSubmit failure must never break the board.
- Branding: use a neutral "IT PMO" wordmark and a corporate blue palette. Do not use a real bank's logo or imitate an official system. Task IDs use the spec-mandated `UOB-ITPM-####` format (`ID_PREFIX`).
- CSS: use custom properties on `:root` for colours and spacing. No `!important`.

## Commands

There is no build, lint or test tooling. To run the app, open `index.html` in a browser. For a quick syntax check of the inline script:

```sh
node -e "const h=require('fs').readFileSync('index.html','utf8');new Function(h.split('<script>')[1].split('</script>')[0]);console.log('ok')"
```

## Architecture (inside the `<script>` block)

- **Single source of truth**: `state = { tasks, filters, ui, nextId }`. `state.ui` holds transient per-card UI: `moveMenuId` (open "Move ▸" menu) and `confirmDeleteId` (inline "Delete? Yes / No").
- **Render from state only**: mutations go through `addTask()`, `moveTask()` and `deleteTask()`, then call `renderBoard()`. `renderBoard()` rebuilds each column's list from `renderCard()` HTML strings and calls `renderSummary()` for the header strip. Do not mutate card contents anywhere else. The only DOM changes outside it are the drag/drop highlight classes and toasts.
- **Focus restoration**: re-rendering replaces card DOM, so interactive card controls carry `data-focus-key`. `renderBoard(focusKey)` focuses that key afterwards, or restores the previously focused key. Keep this pattern when adding card controls, or keyboard users lose focus.
- **Event delegation**: one click listener on `#board` dispatches on `data-action` (`toggle-move`, `move`, `ask-delete`, `cancel-delete`, `confirm-delete`). Escape closes open menus. HTML5 drag-and-drop is also delegated on `#board`, keyed by `.column[data-status]`.
- **Escaping**: every user-supplied string inserted into HTML must go through `escapeHtml()`.
- **Filtering**: `applyFilters()` is pure over `state.tasks`. Column count badges show filtered counts, and the summary strip shows totals over all tasks.
- **Add Task flow** (`handleSubmit`): `validateTask()` produces inline errors via `showFormErrors()` (never `alert()`). It then calls `addTask()` optimistically, resets the form and shows a success toast, then calls `notifyNewTask()` with the submit button in a "Sending…" state. On failure it shows a warning toast and keeps the card.
- **FormSubmit**: `FORMSUBMIT_ENDPOINT` is the one config constant at the top of the script. The address must be activated once via the confirmation email FormSubmit sends on first submission. `notifyNewTask()` treats both non-2xx responses and a `success: "false"` body as failures.
- **Dates**: stored as local `YYYY-MM-DD` strings and compared lexically against `todayISO()`. Seed data uses `addDays()` offsets so the overdue examples stay overdue relative to the current date.
- Fixed enumerations (`STATUSES`, `PRIORITIES`, `PROJECTS`, `CATEGORIES`) drive both the form/filter `<select>` options and validation. The four board columns are static markup whose `data-status` must match `STATUSES`.
