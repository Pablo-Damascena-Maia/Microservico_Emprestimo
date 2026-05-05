require('dotenv').config();
const buildApp = require('./app');

const PORT = Number(process.env.PORT) || 3000;

const fastify = buildApp();

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
