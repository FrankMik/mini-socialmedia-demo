# Mini Social Media App

A small full-stack social media demo application built with **Node.js**, **Express**, **MariaDB**, **HTML**, **CSS**, and **JavaScript**.

This project demonstrates a basic social media platform with user authentication, posts, likes, comments, and follow functionality.

---

# Features

- User registration and login
- Session-based authentication
- Profile page with avatar upload
- Create posts with text and images
- Like and unlike posts
- Nested comments with replies
- Follow / unfollow users
- Following feed
- Real-time post updates using Server-Sent Events (SSE)

---

# Tech Stack

Backend

- Node.js
- Express
- MariaDB / MySQL
- bcryptjs
- express-session
- multer

Frontend

- HTML
- CSS
- JavaScript

---

# Installation

1 Clone the repository
git clone https://github.com/FrankMik/mini-socialmedia-demo.git                 

2 Go into the project directory
cd mini-socialmedia-demo                                            

3 Install dependencies
npm install                     

4 Create a `.env` file based on `.env.example`                              

5 Import the database structure                                 
db/schema.sql

6 Start the server
node server.js                           

7 Open in browser
http://localhost:3000                              

---

# Project Structure

mini-socialmedia-demo
│
├── db
│ └── schema.sql
│
├── public
│ ├── css
│ ├── js
│ ├── images
│ ├── avatars
│ ├── post_images
│ ├── login.html
│ ├── register.html
│ ├── profile.html
│ └── feed.html
│
├── server.js
├── package.json
├── .env.example
└── README.md

---

# Security Notes

Sensitive configuration such as database credentials and session secrets are stored in `.env` files and are not included in this repository.

---

# Note

This repository contains a **demo version of the project for portfolio purposes**.  
Some parts of the original application are simplified or omitted.
