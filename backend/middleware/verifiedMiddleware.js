module.exports = function verifiedMiddleware(req, res, next) {
  const requireVerified = String(process.env.REQUIRE_VERIFIED || 'true').toLowerCase() === 'true';
  if (!requireVerified) return next();
  try {
    const user = req.user;
    if (!user || user.isVerified !== true) {
      return res.status(403).json({ error: 'Conta não verificada. Verifique seu e-mail.' });
    }
    return next();
  } catch (err) {
    return res.status(403).json({ error: 'Conta não verificada.' });
  }
}