const express = require('express');
const db = require('../db/database');
const { requireAuth, requireAdmin, requireOwner } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

function log(actorId, action, target) {
  db.prepare('INSERT INTO admin_log (actor_id, action, target) VALUES (?, ?, ?)').run(actorId, action, target || '');
}

const VALID_THEMES = ['default', 'halloween', 'christmas', 'newyear', 'valentines', 'summer'];

// --- Users list & moderation ---
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, username, display_name, role, verified, banned, ban_reason, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users });
});

router.post('/users/:id/ban', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'owner') return res.status(403).json({ error: 'Owners cannot be banned' });
  const { reason } = req.body;
  db.prepare('UPDATE users SET banned = 1, ban_reason = ? WHERE id = ?').run(reason || '', req.params.id);
  log(req.user.id, 'ban', target.username);
  res.json({ ok: true });
});

router.post('/users/:id/unban', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET banned = 0, ban_reason = \'\' WHERE id = ?').run(req.params.id);
  log(req.user.id, 'unban', target.username);
  res.json({ ok: true });
});

router.post('/users/:id/verify', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(req.params.id);
  log(req.user.id, 'verify', target.username);
  res.json({ ok: true });
});

router.post('/users/:id/unverify', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET verified = 0 WHERE id = ?').run(req.params.id);
  log(req.user.id, 'unverify', target.username);
  res.json({ ok: true });
});

// --- Promotion: only owners can make other people admin ---
router.post('/users/:id/make-admin', requireOwner, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'owner') return res.status(400).json({ error: 'That user is already an owner' });
  db.prepare('UPDATE users SET role = \'admin\' WHERE id = ?').run(req.params.id);
  log(req.user.id, 'make_admin', target.username);
  res.json({ ok: true });
});

router.post('/users/:id/remove-admin', requireOwner, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'owner') return res.status(403).json({ error: 'Cannot demote an owner' });
  db.prepare('UPDATE users SET role = \'user\' WHERE id = ?').run(req.params.id);
  log(req.user.id, 'remove_admin', target.username);
  res.json({ ok: true });
});

// --- Site theme / holiday events ---
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM site_settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json({ settings });
});

router.post('/settings/theme', (req, res) => {
  const { theme } = req.body;
  if (!VALID_THEMES.includes(theme)) return res.status(400).json({ error: 'Unknown theme: ' + theme });
  db.prepare('INSERT INTO site_settings (key, value) VALUES (\'theme\', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(theme);
  log(req.user.id, 'set_theme', theme);
  res.json({ ok: true });
});

router.post('/settings/banner', (req, res) => {
  const { message } = req.body;
  db.prepare('INSERT INTO site_settings (key, value) VALUES (\'banner_message\', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(message || '');
  log(req.user.id, 'set_banner', message || '');
  res.json({ ok: true });
});

// --- Content moderation ---
router.delete('/pins/:id', (req, res) => {
  const pin = db.prepare('SELECT * FROM pins WHERE id = ?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });
  db.prepare('DELETE FROM pins WHERE id = ?').run(req.params.id);
  log(req.user.id, 'delete_pin', String(req.params.id));
  res.json({ ok: true });
});

router.get('/log', (req, res) => {
  const rows = db.prepare(`
    SELECT admin_log.*, users.username as actor_username
    FROM admin_log JOIN users ON users.id = admin_log.actor_id
    ORDER BY admin_log.created_at DESC LIMIT 200
  `).all();
  res.json({ log: rows });
});

module.exports = { router, VALID_THEMES };
