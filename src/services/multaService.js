const prisma = require('../utils/prisma');
const { publish, EVENTS } = require('../config/rabbitmq');

async function listar({ page = 1, limit = 20 }) {
  const [total, data] = await Promise.all([
    prisma.multa.count(),
    prisma.multa.findMany({
      orderBy: { multa_data_geracao: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function buscarPorId(id) {
  const multa = await prisma.multa.findUnique({ where: { multa_id: Number(id) } });
  if (!multa) {
    const err = new Error('Multa não encontrada.');
    err.statusCode = 404; err.code = 'MULTA_NAO_ENCONTRADA'; throw err;
  }
  return multa;
}

async function listarPendentes({ page = 1, limit = 20 }) {
  const where = { multa_status: 'Pendente' };
  const [total, data] = await Promise.all([
    prisma.multa.count({ where }),
    prisma.multa.findMany({
      where,
      orderBy: { multa_data_geracao: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function criar({ valor }) {
  if (!valor) {
    const err = new Error('valor é obrigatório.');
    err.statusCode = 400; err.code = 'DADOS_INVALIDOS'; throw err;
  }
  const multa = await prisma.multa.create({
    data: {
      multa_valor:        Number(valor),
      multa_status:       'Pendente',
      multa_data_geracao: new Date(),
    },
  });
  await publish(EVENTS.MULTA_CRIADA, {
    multaId: multa.multa_id, valor: Number(valor), origem: 'admin',
    timestamp: new Date().toISOString(),
  });
  return multa;
}

async function atualizar(id, { valor, status }) {
  await buscarPorId(id);
  return prisma.multa.update({
    where: { multa_id: Number(id) },
    data: {
      multa_valor:  valor  !== undefined ? Number(valor) : undefined,
      multa_status: status ?? undefined,
    },
  });
}

async function pagar(id, { dataPagamento }) {
  const multa = await buscarPorId(id);
  if (multa.multa_status === 'Paga') {
    const err = new Error('Esta multa já foi paga.');
    err.statusCode = 409; err.code = 'MULTA_JA_PAGA'; throw err;
  }
  const atualizada = await prisma.multa.update({
    where: { multa_id: Number(id) },
    data: {
      multa_status:         'Paga',
      multa_data_pagamento: dataPagamento ? new Date(dataPagamento) : new Date(),
    },
  });
  await publish(EVENTS.MULTA_PAGA, {
    multaId: Number(id), valor: multa.multa_valor,
    timestamp: new Date().toISOString(),
  });
  return atualizada;
}

async function cancelar(id) {
  const multa = await buscarPorId(id);
  if (multa.multa_status === 'Cancelada') {
    const err = new Error('Esta multa já está cancelada.');
    err.statusCode = 409; err.code = 'MULTA_JA_CANCELADA'; throw err;
  }
  const atualizada = await prisma.multa.update({
    where: { multa_id: Number(id) },
    data: { multa_status: 'Cancelada' },
  });
  await publish(EVENTS.MULTA_CANCELADA, {
    multaId: Number(id), timestamp: new Date().toISOString(),
  });
  return atualizada;
}

async function deletar(id) {
  await buscarPorId(id);
  return prisma.multa.delete({ where: { multa_id: Number(id) } });
}

module.exports = { listar, buscarPorId, listarPendentes, criar, atualizar, pagar, cancelar, deletar };
