const Fastify = require('fastify');

const emprestimoRoutes = require('./routes/emprestimos');
const devolucaoRoutes  = require('./routes/devolucoes');
const multaRoutes      = require('./routes/multas');

function buildApp(opts = {}) {
  const fastify = Fastify({ logger: true, ...opts });

  // ── Error handler global ──────────────────────────────────────────────────
  fastify.setErrorHandler((err, req, reply) => {
    const status  = err.statusCode || 500;
    const code    = err.code       || 'ERRO_INTERNO';
    const message = err.message    || 'Erro interno do servidor.';

    fastify.log.error(err);

    return reply.status(status).send({
      success: false,
      error: { code, message, status },
    });
  });

  // ── 404 handler ───────────────────────────────────────────────────────────
  fastify.setNotFoundHandler((req, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code:    'ROTA_NAO_ENCONTRADA',
        message: `Rota ${req.method} ${req.url} não existe.`,
        status:  404,
      },
    });
  });

  // ── Health check ──────────────────────────────────────────────────────────
  fastify.get('/health', async () => ({ status: 'ok', servico: 'emprestimos' }));

  // ── Rotas ─────────────────────────────────────────────────────────────────
  fastify.register(emprestimoRoutes, { prefix: '/emprestimos' });
  fastify.register(devolucaoRoutes,  { prefix: '/devolucoes'  });
  fastify.register(multaRoutes,      { prefix: '/multas'      });

  return fastify;
}

module.exports = buildApp;
