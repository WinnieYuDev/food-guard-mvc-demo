# FoodGuard — Food Safety & Recall Demo (MVC)

FoodGuard is a small demo web app that collects food recall data and shows it in a friendly dashboard.
It is built as an educational, project using the classic MVC pattern (models, views, controllers).

Screenshot: `public/imgs/website.jpg` (used in the project)

Summary
- Shows active food recalls and community posts on the homepage
- Pulls/ingests recall data into MongoDB and renders simplified, readable cards
- Simple user auth, post creation, and image uploads (Cloudinary)


Main features
- Active recall listing with risk-level badges and locations
- Title/Reason sanitization to remove noise (weights, duplicate words, repeated locations)
- Keyword-based image selection plus category fallbacks
- Recent community posts and basic authentication

Launching the app
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

License & credits
- This demo is for learning and demo purposes. Images are provided by Unsplash (via direct URLs) or local assets in `public/imgs`.
