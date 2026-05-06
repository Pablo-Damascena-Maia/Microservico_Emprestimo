require('dotenv').config();

const buildApp             = require('./app');
const { connect, close }   = require('./config/rabbitmq');

const PORT = Number(process.env.PORT) || 9500;

async function start() {
  // 1. Inicia conexão com RabbitMQ (não bloqueia o start do server)
  connect().catch((err) => {
    console.error('[RabbitMQ] Erro inicial (o serviço vai tentar reconectar):', err.message);
  });

  // 2. Sobe o servidor HTTP
  const fastify = buildApp();

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Server] Microsserviço de Empréstimos rodando na porta ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // 3. Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`[Server] ${signal} recebido. Encerrando...`);
    await fastify.close();
    await close();          // fecha canal/conexão RabbitMQ
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start();
