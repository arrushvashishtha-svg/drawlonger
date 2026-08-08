const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    bio: u.bio,
    avatar_url: u.avatar_url,
    role: u.role,
    verified: !!u.verified,
    banned: !!u.banned,
    created_at: u.created_at,
  };
}

router.post('/signup', (req, res) => {
  let { username, display_name, password } = req.body;
  if (!username || !password || !display_name) {
    return res.status(400).json({ error: 'Username, display name, and password are all required' });
  }
  username = String(username).trim().toLowerCase().replace(/\s+/g, '');
  display_name = String(display_name).trim();
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (!/^[a-z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'That username is already taken' });

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare(`
    INSERT INTO users (username, display_name, password_hash, role, verified)
    VALUES (?, ?, ?, 'user', 0)
  `).run(username, display_name, hash);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ user: publicUser(user) });
});

router.post('/login', (req, res) => {
  let { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  username = String(username).trim().toLowerCase().replace(/\s+/g, '');

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  if (user.banned) {
    return res.status(403).json({ error: 'This account has been banned.' + (user.ban_reason ? ' Reason: ' + user.ban_reason : '') });
  }

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = { router, publicUser };
