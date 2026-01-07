module.exports = function verifiedMiddleware(req, res, next) {
  // Verificação de conta desativada: sempre permite acesso
  return next();
}