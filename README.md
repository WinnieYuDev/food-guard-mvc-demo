# FoodGuard — Food Safety & Recall Demo (MVC)

FoodGuard is food safety web application that instantly alerts users about FDA recalls. It provides users real-time product safety information, while helping families make informed decisions about the food they consume.
It is built as an educational project using the classic MVC pattern (models, views, controllers).

<img alt="website preview" src="/public/imgs/preview.jpg">

## Main features
- Displays active food recalls and community posts on the homepage.
- Periodically pulls recall data (USDA and other sources) into MongoDB
- Normalizes and stores recall records, then renders simplified, readable cards with risk-level badges and location info
- Robust filtering of active and inactive recalls based on food category, risk level, retailer, and states affected
- Basic user authentication (Passport), community post creation, and image uploads (Cloudinary + Multer)
- Active recall listing with risk-level badges and locations
- Keyword-based product information look up including allergen and ingredient information

## Tech stack
- **Runtime & framework:** Node.js, Express, Tailwind
- **Templating:** EJS
- **Database:** MongoDB (Mongoose)
- **Authentication:** Passport.js (local)
- **File uploads & images:** Multer, Cloudinary
- **HTTP / API:** Axios
- **Scheduling:** `node-cron` (update scripts)
- **Other:** dotenv, bcryptjs, express-session, connect-mongo, sharp

## Launching the app
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

## Examples:
Take a look at similar projects!

Boston Community Swap: https://github.com/WinnieYuDev/community-trade-fullstack

Home Cooking Reviews: https://github.com/WinnieYuDev/home-cooking-fullstack

## Backend Technologies
MongoDB Atlas: https://www.mongodb.com/atlas/database

## License & credits
- Images are provided by Unsplash (via direct URLs) or local assets in `public/imgs`.
