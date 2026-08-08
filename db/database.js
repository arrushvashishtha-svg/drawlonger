const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'drawlonger.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin' | 'owner'
  verified INTEGER NOT NULL DEFAULT 0,
  banned INTEGER NOT NULL DEFAULT 0,
  ban_reason TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS board_pins (
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  pin_id INTEGER NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  PRIMARY KEY (board_id, pin_id)
);

CREATE TABLE IF NOT EXISTS likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin_id INTEGER NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, pin_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pin_id INTEGER NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// --- Seed the three required accounts (idempotent) ---
function seedUser({ username, display_name, password, role, verified }) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return;
  const hash = bcrypt.hashSync(password, 12);
  db.prepare(`
    INSERT INTO users (username, display_name, password_hash, role, verified)
    VALUES (?, ?, ?, ?, ?)
  `).run(username, display_name, hash, role, verified ? 1 : 0);
}

seedUser({ username: 'drawlonger', display_name: 'drawlonger', password: 'ilikecheese', role: 'owner', verified: 1 });
seedUser({ username: 'hitarthsharma', display_name: 'Hitarth Sharma', password: 'wgoku', role: 'admin', verified: 1 });
seedUser({ username: 'arrushvashistha', display_name: 'Arrush Vashistha', password: 'ilikefeet', role: 'owner', verified: 1 });

// Default site settings (theme)
function seedSetting(key, value) {
  const existing = db.prepare('SELECT key FROM site_settings WHERE key = ?').get(key);
  if (!existing) db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)').run(key, value);
}
seedSetting('theme', 'default');
seedSetting('banner_message', '');

module.exports = db;
