const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare("SELECT id, name, specialty FROM users WHERE role = 'doctor' ORDER BY name").all();
  res.json({ doctors: rows });
});

module.exports = router;