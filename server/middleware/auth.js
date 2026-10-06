const crypto = require('crypto');
const sessions = new Map(); // token -> data user (di memori, hilang saat server restart)

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { id: user.id, name: user.name, email: user.email, role: user.role });
  return token;
}
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user = sessions.get(token);
  if (!user) return res.status(401).json({ error: 'Belum login' });
  req.user = user; req.token = token; next();
}
module.exports = { createSession, requireAuth, sessions };