const { PrismaClient } = require('@prisma/client');

let prisma;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// Proxy que delega todas as propriedades ao PrismaClient real (lazy)
// Isso mantém compatibilidade com todo o código que faz: const prisma = require('./utils/prisma')
module.exports = new Proxy({}, {
  get(_target, prop) {
    return getPrisma()[prop];
  },
});
