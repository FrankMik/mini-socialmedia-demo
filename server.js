require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const app = express();

// === RATE LIMITING ===
const loginAttempts = {};
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function rateLimitLogin(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const entry = loginAttempts[ip] || { count: 0, first: now };

  if (now - entry.first > WINDOW_MS) {
    loginAttempts[ip] = { count: 1, first: now };
    return next();
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return res.status(429).send('Zu viele Login-Versuche, bitte später erneut versuchen.');
  }

  entry.count++;
  loginAttempts[ip] = entry;
  next();
}

const commentAttempts = {};
const COMMENT_WINDOW_MS = 60 * 1000;
const MAX_COMMENTS_PER_MINUTE = 10;

function rateLimitComments(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const entry = commentAttempts[ip] || { count: 0, first: now };

  if (now - entry.first > COMMENT_WINDOW_MS) {
    commentAttempts[ip] = { count: 1, first: now };
  } else if (entry.count >= MAX_COMMENTS_PER_MINUTE) {
    return res.status(429).send('Zu viele Kommentare, bitte später erneut versuchen.');
  } else {
    entry.count++;
    commentAttempts[ip] = entry;
  }
  next();
}

// === MIDDLEWARE (REihenfolge wichtig!) ===
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// SESSION - PERFEKT FÜR LOCALHOST
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,        // localhost!
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24  // 24h
  }
}));

// STATISCHE DATEIEN
app.use(express.static(path.join(__dirname, 'public')));
app.use('/post_images', express.static(path.join(__dirname, 'public/post_images')));
app.use('/avatars', express.static(path.join(__dirname, 'public/avatars')));

// LOGIN-SCHUTZ
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }
  next();
}

// === UPLOAD ===
const upload = multer({ dest: path.join(__dirname, 'public/avatars/') });
const postUpload = multer({
  dest: path.join(__dirname, 'public/post_images/'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilder!'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// === DB ===
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ DB verbunden!');
});

// === GESCHÜTZTE HTML-SEITEN ===
app.get('/feed.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'feed.html'));
});

app.get('/profile.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// === REGISTRIERUNG ===
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  const cleanUsername = (username || '').trim();
  const cleanEmail = (email || '').trim();
  const cleanPassword = (password || '').trim();

  if (cleanUsername.length < 3 || cleanUsername.length > 30) {
    return res.status(400).send('Username 3–30 Zeichen.');
  }
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return res.status(400).send('Ungültige Email.');
  }
  if (cleanPassword.length < 8) {
    return res.status(400).send('Passwort mindestens 8 Zeichen.');
  }

  // Doppelte Email prüfen
  db.query('SELECT * FROM users WHERE email = ?', [cleanEmail], async (err, results) => {
    if (results.length > 0) {
      return res.status(400).send('Email bereits registriert');
    }

    const password_hash = await bcrypt.hash(cleanPassword, 10);
    db.query(
      'INSERT INTO users (username, email, password_hash, avatar_url, bio) VALUES (?, ?, ?, "avatars/default-avatar.png", "")',
      [cleanUsername, cleanEmail, password_hash],
      (err) => {
        if (err) {
          console.log('Register Fehler:', err);
          return res.status(500).send('Registrierung fehlgeschlagen');
        }
        res.redirect('/login.html');
      }
    );
  });
});

// === LOGIN ===
app.post('/login', rateLimitLogin, (req, res) => {
  console.log('Login:', req.body.email);
  
  const { email, password } = req.body;
  const cleanEmail = (email || '').trim();
  const cleanPassword = (password || '').trim();

  if (!cleanEmail.includes('@')) {
    return res.status(400).send('Ungültige Email.');
  }

  db.query('SELECT * FROM users WHERE email = ?', [cleanEmail], async (err, results) => {
    if (err || results.length === 0) {
      console.log('User nicht gefunden');
      return res.status(401).send('Falsche Anmeldedaten');
    }

    const user = results[0];
    const ok = await bcrypt.compare(cleanPassword, user.password_hash || '');
    
    if (!ok) {
      console.log('❌ Passwort falsch');
      return res.status(401).send('Falsche Anmeldedaten');
    }

    // SESSION SETZEN
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url || 'avatars/default-avatar.png',
      bio: user.bio || ''
    };
    
    console.log('✅ LOGIN OK:', user.username);
    res.redirect('/feed.html');
  });
});

// === LOGOUT ===
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send('Logout Fehler');
    res.clearCookie('connect.sid');
    res.redirect('/login.html');
  });
});

// === USER INFO ===
app.get('/me', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).send('Nicht eingeloggt');
  }
});

// === PROFIL UPDATE ===
app.post('/updateProfile', upload.single('avatar'), (req, res) => {
  if (!req.session.user) return res.status(401).send('Nicht eingeloggt');
  
  const { bio } = req.body;
  let avatar_url = req.session.user.avatar_url;

  if (req.file) {
    avatar_url = '/avatars/' + req.file.filename;
  }

  db.query(
    'UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?',
    [bio || '', avatar_url, req.session.user.id],
    (err) => {
      if (err) return res.status(500).send('Update Fehler');
      req.session.user.bio = bio || '';
      req.session.user.avatar_url = avatar_url;
      res.send('Profil aktualisiert');
    }
  );
});

// === POSTS ===
app.post('/post', postUpload.single('image'), (req, res) => {
  if (!req.session.user) return res.status(401).send('Bitte einloggen');

  const content = (req.body.content || '').trim();
  const image = req.file;

  if (!content && !image) {
    return res.status(400).send('Text oder Bild erforderlich');
  }
  if (content.length > 1000) {
    return res.status(400).send('Text max. 1000 Zeichen');
  }

  let image_url = null;
  if (image) {
    image_url = '/post_images/' + image.filename;
  }

  db.query(
    'INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)',
    [req.session.user.id, content, image_url],
    (err, results, fields) => {  // ← results statt result!
      if (err) {
        console.log('Post Fehler:', err);
        return res.status(500).send('Post Fehler');
      }
      
      // NEUER POST → broadcasten
      const newPost = {
        id: results.insertId,      // ← results.insertId
        user_id: req.session.user.id,
        username: req.session.user.username,
        avatar_url: req.session.user.avatar_url,
        content,
        image_url,
        created_at: new Date().toISOString()
      };
      
      broadcastPost(newPost);
      res.send('Post erstellt!');
    }
  );
});

app.get('/posts', (req, res) => {
  db.query(
    `SELECT posts.id, posts.content, posts.image_url, posts.created_at, 
            users.username, users.avatar_url
     FROM posts JOIN users ON posts.user_id = users.id
     ORDER BY posts.created_at DESC LIMIT 50`,
    (err, results) => {
      if (err) return res.status(500).send('Posts Fehler');
      res.json(results);
    }
  );
});

// === POSTS NUR VON USERN, DENEN ICH FOLGE ===
app.get('/posts/following', (req, res) => {
  if (!req.session.user) return res.status(401).send('Bitte einloggen');

  db.query(
    `SELECT p.id, p.content, p.image_url, p.created_at,
            u.username, u.avatar_url
     FROM posts p
     JOIN follows f ON p.user_id = f.followee_id
     JOIN users u ON p.user_id = u.id
     WHERE f.follower_id = ?
     ORDER BY p.created_at DESC
     LIMIT 50`,
    [req.session.user.id],
    (err, results) => {
      if (err) return res.status(500).send('Fehler beim Following-Feed');
      res.json(results);
    }
  );
});

// === LIKES ===
app.post('/like/:id', (req, res) => {
  if (!req.session.user) return res.status(401).send('Bitte einloggen');
  
  const postId = req.params.id;
  db.query('SELECT * FROM likes WHERE user_id = ? AND post_id = ?', 
    [req.session.user.id, postId], 
    (err, results) => {
      if (err) return res.status(500).send('Fehler');
      
      if (results.length > 0) {
        db.query('DELETE FROM likes WHERE user_id = ? AND post_id = ?', 
          [req.session.user.id, postId]);
        return res.send('Unliked!');
      } else {
        db.query('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', 
          [req.session.user.id, postId]);
        return res.send('Geliked!');
      }
    }
  );
});

app.get('/likes/:id', (req, res) => {
  const postId = req.params.id;
  db.query('SELECT COUNT(*) AS likes FROM likes WHERE post_id = ?', [postId], 
    (err, results) => {
      if (err) return res.status(500).send('Fehler');
      res.json({ likes: results[0].likes });
    }
  );
});

// === FOLLOW / UNFOLLOW (Toggle) ===
app.post('/follow/:id', (req, res) => {
  if (!req.session.user) return res.status(401).send('Bitte einloggen');

  const targetId = parseInt(req.params.id, 10);
  const currentId = req.session.user.id;

  if (!targetId || targetId === currentId) {
    return res.status(400).send('Ungültige Ziel-ID');
  }

  db.query(
    'SELECT * FROM follows WHERE follower_id = ? AND followee_id = ?',
    [currentId, targetId],
    (err, results) => {
      if (err) return res.status(500).send('Fehler bei Follow');

      if (results.length > 0) {
        // Entfolgen
        db.query(
          'DELETE FROM follows WHERE follower_id = ? AND followee_id = ?',
          [currentId, targetId],
          (err2) => {
            if (err2) return res.status(500).send('Fehler beim Unfollow');
            res.json({ status: 'unfollowed' });
          }
        );
      } else {
        // Folgen
        db.query(
          'INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)',
          [currentId, targetId],
          (err2) => {
            if (err2) {
              // UNIQUE-Verstoß abfangen
              if (err2.code === 'ER_DUP_ENTRY') {
                return res.json({ status: 'followed' });
              }
              return res.status(500).send('Fehler beim Follow');
            }
            res.json({ status: 'followed' });
          }
        );
      }
    }
  );
});

// === LISTE: User, denen ich folge ===
app.get('/following', (req, res) => {
  if (!req.session.user) return res.status(401).send('Bitte einloggen');

  db.query(
    `SELECT u.id, u.username, u.avatar_url
     FROM follows f
     JOIN users u ON f.followee_id = u.id
     WHERE f.follower_id = ?`,
    [req.session.user.id],
    (err, results) => {
      if (err) return res.status(500).send('Fehler beim Laden der Following-Liste');
      res.json(results);
    }
  );
});

// === KOMMENTARE ===
app.post('/comment/:id', rateLimitComments, (req, res) => {
  if (!req.session.user) return res.status(401).send('Bitte einloggen');
  
  const postId = req.params.id;
  const { content, parent_comment_id } = req.body;
  
  const trimmedContent = (content || '').trim();
  if (!trimmedContent || trimmedContent.length > 500) {
    return res.status(400).send('Kommentar ungültig');
  }

  const parentId = parent_comment_id ? parseInt(parent_comment_id) : null;
  db.query(
    'INSERT INTO comments (user_id, post_id, content, parent_comment_id) VALUES (?, ?, ?, ?)',
    [req.session.user.id, postId, trimmedContent, parentId],
    (err) => {
      if (err) return res.status(500).send('Kommentar Fehler');
      res.send('Kommentar erstellt!');
    }
  );
});

app.get('/comments/:id', (req, res) => {
  const postId = req.params.id;
  db.query(
    `SELECT comments.id, comments.content, comments.parent_comment_id,
            users.username, users.avatar_url
     FROM comments JOIN users ON comments.user_id = users.id
     WHERE comments.post_id = ?
     ORDER BY comments.id ASC`,
    [postId],
    (err, results) => {
      if (err) return res.status(500).send('Kommentare Fehler');
      res.json(results);
    }
  );
});

// === ECHTZEIT POSTS (SSE) ===
const clients = new Set(); // Alle verbundenen Browser

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const client = {
    res,
    send: (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };
  
  clients.add(client);
  
  req.on('close', () => {
    clients.delete(client);
  });
  
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
});

// Broadcast neue Posts an alle
function broadcastPost(post) {
  clients.forEach(client => {
    if (!client.res.writableEnded) {
      client.send({ type: 'new_post', post });
    }
  });
}

// === SERVER START ===
app.listen(3000, () => {
  console.log('🚀 Server läuft auf http://localhost:3000');
});
