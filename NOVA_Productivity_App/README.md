# NOVA — Surreal Productivity App

Built with plain HTML, CSS, and JavaScript. No framework or build step is needed.

## Run locally
1. Extract this ZIP.
2. Open the folder in VS Code.
3. Open `index.html` with Live Server, or open it in a browser.

## Included
- Surreal Y2K-inspired landing page and CSS-built artwork
- Task create/edit/delete/complete, priority and category filters
- Month/week calendar with task markers and selected-day task creation
- Browser notifications for reminders (permission required; browser must remain available)
- Pomodoro, short break, and long break timer
- Habit checklist, goal progress, quick notes, dashboard statistics
- Dark/light theme toggle and responsive mobile navigation
- Data persistence through browser `localStorage`

## Notes / limitations
- This is a front-end-only app. Data is saved only in the current browser on this device; it does not sync across devices or users.
- Browser notifications require permission. A timer created with `setTimeout` may not fire if the browser is closed or the device sleeps.
- The demo focus timer credits a 25-minute Pomodoro when it completes; short and long breaks do not add focus minutes.
- To reset the demo data, clear local storage for the page or run `localStorage.removeItem('nova-productivity-v1')` in the browser console.
- Replace sample tasks/goals and adjust copy before publishing.
