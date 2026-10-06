# IT PMO Kanban Board

A single-page Kanban board for a fictitious bank's internal IT Project Management Office, built as a demo and training tool. Tasks move through four columns: Backlog, In Progress, Blocked and Done. New tasks can trigger an email notification through [FormSubmit](https://formsubmit.co). Everything is in one `index.html` file, written in plain HTML, CSS and JavaScript, with no dependencies and no build step.

**Live demo:** https://super211.github.io/kanban/

> Demo mode: the board lives in memory only. Refreshing the page resets it to the eight sample tasks.

## Features

- **Four-column Kanban board**: each column has a live task count. Columns sit side by side on desktop and stack on screens narrower than 768px.
- **Task cards**: each card shows the task ID (`UOB-ITPM-####`), title, project/workstream, assignee, a priority pill, the due date and a category tag.
- **Priority colours**: the card's left border is red for Critical, amber for High, blue for Medium and grey for Low. The priority is also shown as text.
- **Overdue badge**: shown on tasks that are past their due date and not yet Done.
- **Drag and drop** between columns, using the native HTML5 API, with a highlight on the column you're dropping into.
- **Keyboard-friendly moving**: a "Move ▸" menu on every card. Escape closes open menus.
- **Inline delete confirmation**: "Delete? Yes / No" appears on the card itself, with no browser pop-up.
- **Add Task form**: validation errors appear under each field, the due date can't be in the past, and a toast confirms success.
- **Instant updates**: a new card appears straight away while the email notification is sent in the background. If sending fails, the card stays and a warning toast appears.
- **Filter bar**: filter by project, by assignee (any name containing the text you type) and by priority.
- **Summary strip in the header**: totals, counts per status, and the number of overdue tasks.
- **Accessibility**: semantic HTML, a label on every input, visible focus rings, and screen-reader announcements for toasts.

## Run locally

Double-click `index.html`, or open it in any modern browser. No server or install is needed.

## Configuration

The email notification address is set in one constant near the top of the `<script>` block in `index.html`:

```js
const FORMSUBMIT_ENDPOINT = "https://formsubmit.co/ajax/YOUR_EMAIL@example.com";
```

Replace `YOUR_EMAIL@example.com` with the inbox that should receive new-task notifications.

**FormSubmit activation (one-time):** the first submission sends a confirmation email to that address. Notifications are only delivered after you click the activation link in it. Until then, adding a task shows "Card added locally — email notification failed", and the card stays on the board.

## Deployment

Every push to `main` deploys `index.html` to GitHub Pages through the workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml). You can also run it by hand from the **Actions** tab.

## Tech stack

Vanilla HTML5, CSS (custom properties) and JavaScript (ES2020). No frameworks, no external resources, no build step. FormSubmit sends the email notifications.
