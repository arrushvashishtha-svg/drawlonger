const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM site_settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json({ settings });
});

module.exports = router;
