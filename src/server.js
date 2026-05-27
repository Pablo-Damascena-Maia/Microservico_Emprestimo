require('dotenv').config();
 
const { loadSecrets }    = require('./config/infisical');
const buildApp           = require('./app');
const { connect, close } = require('./config/rabbitmq');
 
const PORT = Number(process.env.PORT) || 9500;
 
async function start() {
  await loadSecrets();
 
  connect().catch((err) => {
    console.error('[RabbitMQ] Erro inicial (tentará reconectar):', err.message);
  });
 
  // buildApp agora é async — obrigatório usar await aqui
  const fastify = await buildApp();
 
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Server] Microsserviço de Empréstimos rodando na porta ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
 
  const shutdown = async (signal) => {
    console.log(`[Server] ${signal} recebido. Encerrando...`);
    await fastify.close();
    await close();
    process.exit(0);
  };
 
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}
 
start();