'use strict';
 
const Fastify = require('fastify');
const cors    = require('@fastify/cors');
 
const emprestimoRoutes = require('./routes/emprestimos');
const devolucaoRoutes  = require('./routes/devolucoes');
const multaRoutes      = require('./routes/multas');
 
async function buildApp(opts = {}) {
  const fastify = Fastify({ logger: true, ...opts });
 
  // 1. CORS com await — garante que o plugin está 100% ativo
  //    antes de qualquer rota, handler de erro ou preflight OPTIONS
  await fastify.register(cors, {
    origin: true,                        // aceita qualquer origem (dev)
    methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflight: true,
    strictPreflight: false,
  });
 
  // 2. Error handler
  fastify.setErrorHandler((err, req, reply) => {
    const status  = err.statusCode || 500;
    const code    = err.code       || 'ERRO_INTERNO';
    const message = err.message    || 'Erro interno do servidor.';
    fastify.log.error(err);
    return reply.status(status).send({ success: false, error: { code, message, status } });
  });
 
  // 3. 404 handler
  fastify.setNotFoundHandler((req, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code: 'ROTA_NAO_ENCONTRADA',
        message: `Rota ${req.method} ${req.url} não existe.`,
        status: 404,
      },
    });
  });
 
  // 4. Health check — usado pelo dashboard para verificar se o serviço está online
  fastify.get('/health', async () => ({ status: 'ok', servico: 'emprestimos' }));
 
  // 5. Rotas de negócio
  fastify.register(emprestimoRoutes, { prefix: '/emprestimos' });
  fastify.register(devolucaoRoutes,  { prefix: '/devolucoes'  });
  fastify.register(multaRoutes,      { prefix: '/multas'      });
 
  return fastify;
}
 
module.exports = buildApp;