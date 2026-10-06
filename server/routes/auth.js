const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { createSession, requireAuth, sessions } = require('../middleware/auth');
const router = express.Router();

// Hash password dengan scrypt bawaan Node (bukan bagian RSA)
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}
const isHex = (s) => typeof s === 'string' && /^[0-9a-f]+$/i.test(s);
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, specialty: u.specialty, publicKey: JSON.parse(u.public_key) });

router.post('/register', (req, res) => {
  const { name, email, password, role, specialty, publicKey } = req.body || {};
  if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'Data tidak lengkap (password minimal 8 karakter)' });
  if (!['patient', 'doctor'].includes(role)) return res.status(400).json({ error: 'Peran tidak valid' });
  if (!publicKey || !isHex(publicKey.n) || !isHex(publicKey.e) || BigInt('0x' + publicKey.n).toString(2).length < 1000)
    return res.status(400).json({ error: 'Kunci publik tidak valid' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Email sudah terdaftar' });
  const info = db.prepare('INSERT INTO users (name,email,password_hash,role,specialty,public_key) VALUES (?,?,?,?,?,?)')
    .run(name, email, hashPassword(password), role, role === 'doctor' ? (specialty || 'Umum') : null, JSON.stringify({ n: publicKey.n, e: publicKey.e }));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ token: createSession(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
  if (!user || !checkPassword(password || '', user.password_hash)) return res.status(401).json({ error: 'Email atau password salah' });
  res.json({ token: createSession(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});
router.post('/logout', requireAuth, (req, res) => { sessions.delete(req.token); res.json({ ok: true }); });

module.exports = router;