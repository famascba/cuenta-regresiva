const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'cuenta-regresiva-dev-secret';

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '24h' });
}

function verify(token) {
  return jwt.verify(token, SECRET);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado', authenticated: false });
  }
  try {
    req.user = verify(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado', authenticated: false });
  }
}

module.exports = { sign, verify, requireAuth };
