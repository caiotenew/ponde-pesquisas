function errorHandler(error, req, res, next) {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(error.status || 500).json({
    error: error.publicMessage || 'Erro interno do servidor.'
  });
}

module.exports = errorHandler;
