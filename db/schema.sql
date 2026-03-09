CREATE TABLE users (
 id INT AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(30),
 email VARCHAR(255),
 password_hash VARCHAR(255),
 avatar_url VARCHAR(255),
 bio TEXT
);

CREATE TABLE posts (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT,
 content TEXT,
 image_url VARCHAR(255),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE likes (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT,
 post_id INT
);

CREATE TABLE comments (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT,
 post_id INT,
 content TEXT,
 parent_comment_id INT
);

CREATE TABLE follows (
 id INT AUTO_INCREMENT PRIMARY KEY,
 follower_id INT,
 followee_id INT
);