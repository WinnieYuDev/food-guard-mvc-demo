# FoodGuard — Food Safety & Recall Demo (MVC)

FoodGuard is a small demo web app that collects food recall data and shows it in a friendly dashboard.
It is built as an educational, beginner-friendly project using the classic MVC pattern (models, views, controllers).

Screenshot: `public/imgs/website.jpg` (used in the project)

Summary
- Shows active food recalls and community posts on the homepage
- Pulls/ingests recall data into MongoDB and renders simplified, readable cards
- Simple user auth, post creation, and image uploads (Cloudinary)

How data flows (high level)
- A background importer or the `services/recallAPI.js` fetches recall data from public sources (FDA, etc.)
- Data is stored as `Recall` documents in MongoDB (`models/Recall.js`)
- `controllers/home.js` loads active recalls, cleans titles/reasons, and chooses an image for each card
- `views/index.ejs` receives prepared fields (`cleanedTitle`, `cleanedReason`, `locations`, `categoryImage`) and renders the homepage

Main features
- Active recall listing with risk-level badges and locations
- Title/Reason sanitization to remove noise (weights, duplicate words, repeated locations)
- Keyword-based image selection plus category fallbacks
- Recent community posts and basic authentication

Quick start (development)
1. Clone:
  ```powershell
  git clone https://github.com/WinnieYuDev/food-guard-mvc-demo
  cd food-guard-mvc-demo
  ```
2. Install dependencies:
  ```powershell
  npm install
  ```
3. Create a `.env` file in the project root or `config/` folder with these values (example):
  ```text
  PORT=3000
  MONGODB_URI=mongodb://localhost:27017/foodguard_db
  CLOUDINARY_CLOUD_NAME=your_cloud_name
  CLOUDINARY_API_KEY=your_api_key
  CLOUDINARY_API_SECRET=your_api_secret
  NODE_ENV=development
  ```
4. Start the app:
  ```powershell
  npm start
  ```
5. Open `http://localhost:3000` in your browser.

Notes & tips for beginners
- If the homepage images do not appear, check that URLs returned for `recall.categoryImage` are valid.
  - Local image files should be under `public/imgs` and referenced with `/imgs/<filename>`.
  - The mapping lives in `controllers/home.js` (look for `categoryImageMap` and `keywordImageMap`).
- To change the homepage behavior (title cleaning, image selection), edit `controllers/home.js`. Helpers are small and documented there.
- To seed sample data for testing, check `utils/seedRecalls.js` (if present) or insert documents in MongoDB using `mongo`/Compass.

Troubleshooting
- If `node server.js` errors with EADDRINUSE, another process is using the port (stop it or change `PORT`).
- If MongoDB fails to connect, verify `MONGODB_URI` and that MongoDB is running.

Project structure (important files)
- `server.js` — app bootstrap and route registration
- `controllers/home.js` — prepares homepage data (sanitization + image selection)
- `models/Recall.js` — Mongoose schema for recall records
- `services/recallAPI.js` — external API fetch / import (where available)
- `views/index.ejs` — homepage template
- `public/imgs/` — local images (placeholder and logo)

Want more help?
- I can add: local category images in `public/imgs/`, a small test dataset, or step-by-step video-style README instructions. Tell me which you'd prefer.

License & credits
- This demo is for learning and demo purposes. Images are provided by Unsplash (via direct URLs) or local assets in `public/imgs`.
