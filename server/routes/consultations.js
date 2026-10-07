const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

const isHex = (s) => typeof s === 'string' && /^[0-9a-f]+$/i.test(s);
const validBlocks = (a) => Array.isArray(a) && a.length > 0 && a.length <= 60 && a.every(isHex);

// Ambil konsultasi, hanya boleh diakses pasien/dokter yang bersangkutan
function getConsultation(req, res) {
  const c = db.prepare('SELECT * FROM consultations WHERE id = ?').get(req.params.id);
  if (!c || (c.patient_id !== req.user.id && c.doctor_id !== req.user.id)) {
    res.status(404).json({ error: 'Konsultasi tidak ditemukan' });
    return null;
  }
  return c;
}

// Mulai konsultasi (pasien -> dokter)
router.post('/', (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Hanya pasien yang bisa memulai konsultasi' });
  const doc = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'doctor'").get(req.body.doctorId);
  if (!doc) return res.status(404).json({ error: 'Dokter tidak ditemukan' });
  let c = db.prepare("SELECT id FROM consultations WHERE patient_id = ? AND doctor_id = ? AND status = 'open'").get(req.user.id, doc.id);
  if (!c) {
    const info = db.prepare('INSERT INTO consultations (patient_id, doctor_id) VALUES (?, ?)').run(req.user.id, doc.id);
    c = { id: info.lastInsertRowid };
  }
  res.json({ id: c.id });
});

// Daftar konsultasi milik user yang login
router.get('/', (req, res) => {
  const id = req.user.id;
  const rows = db.prepare(`
    SELECT c.id, c.status, c.created_at, u.name AS other_name
    FROM consultations c
    JOIN users u ON u.id = CASE WHEN c.patient_id = ? THEN c.doctor_id ELSE c.patient_id END
    WHERE c.patient_id = ? OR c.doctor_id = ?
    ORDER BY c.id DESC`).all(id, id, id);
  res.json({ consultations: rows });
});

// Detail konsultasi + kunci publik lawan bicara
router.get('/:id', (req, res) => {
  const c = getConsultation(req, res); if (!c) return;
  const other = db.prepare('SELECT id, name, specialty, public_key FROM users WHERE id = ?')
    .get(c.patient_id === req.user.id ? c.doctor_id : c.patient_id);
  res.json({ id: c.id, other: { id: other.id, name: other.name, specialty: other.specialty, publicKey: JSON.parse(other.public_key) } });
});

// Ambil pesan (hanya ciphertext), opsional ?after=<id terakhir>
router.get('/:id/messages', (req, res) => {
  const c = getConsultation(req, res); if (!c) return;
  const rows = db.prepare('SELECT id, sender_id, ciphertext, created_at FROM messages WHERE consultation_id = ? AND id > ? ORDER BY id')
    .all(c.id, Number(req.query.after) || 0);
  res.json({ messages: rows.map((m) => ({ ...m, ciphertext: JSON.parse(m.ciphertext) })) });
});

// Kirim pesan: server hanya menerima dan menyimpan ciphertext
router.post('/:id/messages', (req, res) => {
  const c = getConsultation(req, res); if (!c) return;
  const ct = req.body && req.body.ciphertext;
  if (!ct || !validBlocks(ct.forRecipient) || !validBlocks(ct.forSender))
    return res.status(400).json({ error: 'Format ciphertext tidak valid' });
  const info = db.prepare('INSERT INTO messages (consultation_id, sender_id, ciphertext) VALUES (?, ?, ?)')
    .run(c.id, req.user.id, JSON.stringify({ forRecipient: ct.forRecipient, forSender: ct.forSender }));
  res.json({ id: info.lastInsertRowid });
});

module.exports = router;