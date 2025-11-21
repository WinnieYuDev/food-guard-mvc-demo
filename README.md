# FoodGuard - Food Safety & Recall Alert System

FoodGuard is a comprehensive web application that helps users stay informed about food recalls, safety alerts, and product information. It integrates real-time data from multiple food safety APIs to provide up-to-date information about food recalls and product safety.

![alt text](/public/imgs/website.jpg)

## Features

### User Authentication
- **User Registration & Login** - Secure user accounts with encrypted passwords
- **Session Management** - Persistent login sessions with Passport.js
- **Profile Management** - User profiles with avatar support

### Food Recall Monitoring
- **Real-time Recall Data** - Integration with FDA Food Recall API
- **Multiple Data Sources** - FDA, USDA, and Open Food Facts data
- **Risk Level Classification** - Automatic classification of recalls by risk (High/Medium/Low)
- **Search & Filtering** - Advanced search by product name, brand, risk level, and source
- **Barcode Lookup** - Check specific products using barcode scanning

### Community Features
- **Discussion Forum** - Community posts about food safety
- **Comment System** - Engage with other users' posts
- **Like System** - Like posts and comments
- **Image Upload** - Share photos with posts (Cloudinary integration)

### Modern UI/UX
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Tailwind CSS** - Modern, clean interface
- **Real-time Notifications** - Flash messages for user feedback
- **Accessible Design** - WCAG compliant components

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database with Mongoose ODM
- **Passport.js** - Authentication middleware
- **BCrypt** - Password hashing
- **Express Sessions** - Session management

### Frontend
- **EJS** - Template engine
- **Tailwind CSS** - Utility-first CSS framework
- **JavaScript** - Client-side interactivity

### External APIs
- **FDA Food Recall API** - Real food recall data
- **Open Food Facts API** - Product information
- **Cloudinary** - Image storage and CDN

## Installation & Setup

1. Clone the repository:  bash git clone https://github.com/WinnieYuDev/binary-upload-boom

2. Install modules `npm install`

---

# Things to add

- Create a `.env` file in config folder and add the following as `key = value`
  - PORT = 2121 (can be any port example: 3000)
  - MONGODB_URI = `your database URI`
  - ClOUNDINARY_CLOUD_NAME = `your cloudinary cloud name`
  - ClOUNDINARY_API_KEY = `your cloudinary api key`
  - ClOUNDINARY_API_SECRET = `your cloudinary api secret`
  - NODE_ENV=development

---

# Run

`npm start`

## Examples:
Feel free to take a look at other fullstack applications I worked on:

Boston Community Trade Swap: https://github.com/WinnieYuDev/community-trade-fullstack

Homecooking Reviews: https://github.com/WinnieYuDev/home-cooking-fullstack