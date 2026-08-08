const express = require('express');
const db = require('../db/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { upload, configured } = require('../db/cloudinary');

const router = express.Router();

function pinOut(row, userId) {
  const likeCount = db.prepare('SELECT COUNT(*) c FROM likes WHERE pin_id = ?').get(row.id).c;
  const liked = userId ? !!db.prepare('SELECT 1 FROM likes WHERE pin_id = ? AND user_id = ?').get(row.id, userId) : false;
  const commentCount = db.prepare('SELECT COUNT(*) c FROM comments WHERE pin_id = ?').get(row.id).c;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    image_url: row.image_url,
    created_at: row.created_at,
    author: {
      id: row.user_id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      verified: !!row.verified,
    },
    like_count: likeCount,
    liked,
    comment_count: commentCount,
  };
}

const PIN_JOIN = `
  SELECT pins.*, users.username, users.display_name, users.avatar_url, users.verified
  FROM pins JOIN users ON users.id = pins.user_id
`;

router.get('/feed', optionalAuth, (req, res) => {
  const rows = db.prepare(`${PIN_JOIN} WHERE users.banned = 0 ORDER BY pins.created_at DESC LIMIT 100`).all();
  res.json({ pins: rows.map(r => pinOut(r, req.user && req.user.id)) });
});

router.get('/pin/:id', optionalAuth, (req, res) => {
  const row = db.prepare(`${PIN_JOIN} WHERE pins.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Pin not found' });
  const comments = db.prepare(`
    SELECT comments.*, users.username, users.display_name, users.avatar_url, users.verified
    FROM comments JOIN users ON users.id = comments.user_id
    WHERE pin_id = ? ORDER BY comments.created_at ASC
  `).all(req.params.id);
  res.json({
    pin: pinOut(row, req.user && req.user.id),
    comments: comments.map(c => ({
      id: c.id, body: c.body, created_at: c.created_at,
      author: { username: c.username, display_name: c.display_name, avatar_url: c.avatar_url, verified: !!c.verified },
    })),
  });
});

router.get('/user/:username', optionalAuth, (req, res) => {
  const author = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
  if (!author) return res.status(404).json({ error: 'User not found' });
  const rows = db.prepare(`${PIN_JOIN} WHERE pins.user_id = ? ORDER BY pins.created_at DESC`).all(author.id);
  res.json({
    user: {
      id: author.id, username: author.username, display_name: author.display_name,
      bio: author.bio, avatar_url: author.avatar_url, role: author.role,
      verified: !!author.verified, created_at: author.created_at,
    },
    pins: rows.map(r => pinOut(r, req.user && req.user.id)),
  });
});

router.post('/create', requireAuth, upload.single('image'), (req, res) => {
  const { title, description } = req.body;
  if (!req.file) return res.status(400).json({ error: 'An image is required' });
  if (!title || !title.trim()) return res.status(400).json({ error: 'A title is required' });

  const imageUrl = configured ? req.file.path : `/uploads/${req.file.filename}`;
  const info = db.prepare(`
    INSERT INTO pins (user_id, title, description, image_url) VALUES (?, ?, ?, ?)
  `).run(req.user.id, title.trim(), (description || '').trim(), imageUrl);

  const row = db.prepare(`${PIN_JOIN} WHERE pins.id = ?`).get(info.lastInsertRowid);
  res.json({ pin: pinOut(row, req.user.id) });
});

router.delete('/pin/:id', requireAuth, (req, res) => {
  const pin = db.prepare('SELECT * FROM pins WHERE id = ?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });
  const isOwnerOfPin = pin.user_id === req.user.id;
  const isMod = req.user.role === 'admin' || req.user.role === 'owner';
  if (!isOwnerOfPin && !isMod) return res.status(403).json({ error: 'You can only delete your own pins' });
  db.prepare('DELETE FROM pins WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/pin/:id/like', requireAuth, (req, res) => {
  const pin = db.prepare('SELECT id FROM pins WHERE id = ?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });
  const existing = db.prepare('SELECT 1 FROM likes WHERE pin_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (existing) {
    db.prepare('DELETE FROM likes WHERE pin_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  } else {
    db.prepare('INSERT INTO likes (pin_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
  }
  const likeCount = db.prepare('SELECT COUNT(*) c FROM likes WHERE pin_id = ?').get(req.params.id).c;
  res.json({ liked: !existing, like_count: likeCount });
});

router.post('/pin/:id/comment', requireAuth, (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  const pin = db.prepare('SELECT id FROM pins WHERE id = ?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });
  const info = db.prepare('INSERT INTO comments (pin_id, user_id, body) VALUES (?, ?, ?)').run(req.params.id, req.user.id, body.trim());
  const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid);
  res.json({
    comment: {
      id: c.id, body: c.body, created_at: c.created_at,
      author: { username: req.user.username, display_name: req.user.display_name, avatar_url: req.user.avatar_url, verified: !!req.user.verified },
    },
  });
});

// Boards
router.get('/boards/mine', requireAuth, (req, res) => {
  const boards = db.prepare('SELECT * FROM boards WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ boards });
});

router.post('/boards', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'A board name is required' });
  const info = db.prepare('INSERT INTO boards (user_id, name) VALUES (?, ?)').run(req.user.id, name.trim());
  res.json({ board: db.prepare('SELECT * FROM boards WHERE id = ?').get(info.lastInsertRowid) });
});

router.post('/boards/:id/add/:pinId', requireAuth, (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  db.prepare('INSERT OR IGNORE INTO board_pins (board_id, pin_id) VALUES (?, ?)').run(req.params.id, req.params.pinId);
  res.json({ ok: true });
});

router.get('/boards/:id', optionalAuth, (req, res) => {
  const board = db.prepare('SELECT boards.*, users.username FROM boards JOIN users ON users.id = boards.user_id WHERE boards.id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  const rows = db.prepare(`
    ${PIN_JOIN.replace('SELECT', 'SELECT')} 
    JOIN board_pins ON board_pins.pin_id = pins.id
    WHERE board_pins.board_id = ? ORDER BY pins.created_at DESC
  `).all(req.params.id);
  res.json({ board, pins: rows.map(r => pinOut(r, req.user && req.user.id)) });
});

module.exports = router;
