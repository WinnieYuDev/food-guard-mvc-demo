# FoodGuard — Data Flow (Simple)

This short guide explains, in simple words, how data moves through FoodGuard. It shows what happens when the user asks for recalls and how the server prepares the results.

## Front → Back (What the browser does)

- The user opens a page in the browser (for example `/recalls`).
- The browser sends a request to the server (Express routes). Example: `GET /recalls`.
- Routes (files in `routes/`) send the request to controller functions (files in `controllers/`).

Simple example: The browser asks `/recalls?category=seafood` → `routes/recalls.js` → `controllers/recalls.getRecalls()`.

## What Controllers do (short)

- Controllers read the request (filters like category, search, page).
- They try to get fresh data from external APIs (through `services/recallAPI.js`).
- If the API is slow, controllers use the database (`models/Recall`) as a fast fallback.
- Controllers clean and standardize each recall (call `normalizeRecallData()`).
- Finally, they send rendered HTML (EJS) or JSON back to the browser.

## Services (fetching external data)

- `services/recallAPI.js` talks to external sources (FDA openFDA, FSIS).
- It converts raw provider data into the app's shape and guesses a category (like "seafood" or "produce").

## Database (models)

- The app stores normalized recalls in MongoDB (model: `models/Recall.js`).
- When the normalization rules change, the app can update old records with `reNormalizeAllRecalls()`.

## Back → Front (How the server prepares data for the browser)

1. Service layer fetches provider data and transforms it into a consistent format.
2. Controller applies final clean-up: makes the title `Product — Brand`, sets `articleLink` (or builds a fallback FDA search URL), and ensures the `category` is set.
3. The controller saves normalized items to the DB (optional) and then renders the page using EJS templates.
4. The browser receives ready-to-display HTML with precomputed fields (title, category label, image URL).

## Important small rules

- Titles are shown as `Product — Brand` when both are present.
- The app prefers a valid article URL from the provider. If none exists, it builds a safe FDA search URL.
- Category detection runs both when the app imports live API results and when normalizing DB records. This keeps live and stored data similar.

## Quick list: Files to look at

- `server.js` — app setup and middleware
- `routes/recalls.js` — maps `/recalls` to the controller
- `controllers/recalls.js` — main logic for getting and normalizing recalls
- `services/recallAPI.js` — external fetch + transform code
- `models/Recall.js` — MongoDB schema
- `views/recalls.ejs` and `public/js/recalls.js` — UI and client code



