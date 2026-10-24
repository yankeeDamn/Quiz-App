# Exampro

A single-file front-end demo of a multi-tenant mock-test platform for coaching institutes: branded portals,
22 mock tests (120 questions), a timed exam window, practice mode, results with review, a pricing page,
demo sign-in and WhatsApp coaching/doubt links.

Open `index.html` in a browser. There is no build step and nothing to install. Fonts load from Google Fonts.

## Settings to fill in (all in `index.html`)

| What | Where |
|---|---|
| WhatsApp number | `SITE_WA` near the top of the `<script>` (country code + number, digits only) |
| Plan names, prices, limits | `PLANS` and `CMP` in the pricing section of the script |
| Question bank | `TOPICS` array: `[question, [4 options], correctIndex, explanation]` |
| Mock test layout | `FULL` array (sections, marks, negative marking, time) |
| Institute branding | Portal builder on the page, saved in the visitor's browser |

## Not built yet

Real sign-in (mobile OTP), a database and backend for per-institute students, batches and results,
online payments, CSV question upload, batch analytics and parent WhatsApp updates.
The sign-in, attempts, bookmarks and branding are stored in the browser's localStorage only.
