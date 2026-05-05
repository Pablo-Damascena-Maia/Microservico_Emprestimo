const fp     = require('fastify-plugin');
const prisma = require('../utils/prisma');

async function prismaPlugin(fastify) {
  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}

module.exports = fp(prismaPlugin);
