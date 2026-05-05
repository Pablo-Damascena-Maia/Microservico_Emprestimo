const prisma = require('../utils/prisma');

async function listar({ page = 1, limit = 20 }) {
  const [total, data] = await Promise.all([
    prisma.multa.count(),
    prisma.multa.findMany({
      include: { emprestimo: true },
      orderBy: { criadaEm: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function buscarPorId(id) {
  const multa = await prisma.multa.findUnique({
    where: { id: Number(id) },
    include: { emprestimo: true },
  });
  if (!multa) {
    const err = new Error('Multa não encontrada.');
    err.statusCode = 404;
    err.code = 'MULTA_NAO_ENCONTRADA';
    throw err;
  }
  return multa;
}

async function buscarPorUsuario(usuarioId, { page = 1, limit = 20 }) {
  const where = { emprestimo: { usuarioId: Number(usuarioId) } };
  const [total, data] = await Promise.all([
    prisma.multa.count({ where }),
    prisma.multa.findMany({
      where,
      include: { emprestimo: true },
      orderBy: { criadaEm: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function listarPendentes({ page = 1, limit = 20 }) {
  const where = { status: 'PENDENTE' };
  const [total, data] = await Promise.all([
    prisma.multa.count({ where }),
    prisma.multa.findMany({
      where,
      include: { emprestimo: true },
      orderBy: { criadaEm: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function criar({ emprestimoId, valor, motivo, diasAtraso = 0 }) {
  if (!emprestimoId || !valor || !motivo) {
    const err = new Error('emprestimoId, valor e motivo são obrigatórios.');
    err.statusCode = 400;
    err.code = 'DADOS_INVALIDOS';
    throw err;
  }
  return prisma.multa.create({
    data: {
      emprestimoId: Number(emprestimoId),
      valor:        Number(valor),
      motivo,
      diasAtraso:   Number(diasAtraso),
      status:       'PENDENTE',
    },
  });
}

async function atualizar(id, { valor, motivo, status }) {
  await buscarPorId(id);
  return prisma.multa.update({
    where: { id: Number(id) },
    data: {
      valor:  valor  !== undefined ? Number(valor) : undefined,
      motivo: motivo ?? undefined,
      status: status ?? undefined,
    },
  });
}

async function pagar(id, { formaPagamento, dataPagamento }) {
  const multa = await buscarPorId(id);
  if (multa.status === 'PAGO') {
    const err = new Error('Esta multa já foi paga.');
    err.statusCode = 409;
    err.code = 'MULTA_JA_PAGA';
    throw err;
  }
  return prisma.multa.update({
    where: { id: Number(id) },
    data: {
      status:         'PAGO',
      formaPagamento: formaPagamento ?? undefined,
      pagoEm:         dataPagamento ? new Date(dataPagamento) : new Date(),
    },
  });
}

async function cancelar(id) {
  const multa = await buscarPorId(id);
  if (multa.status === 'CANCELADO') {
    const err = new Error('Esta multa já está cancelada.');
    err.statusCode = 409;
    err.code = 'MULTA_JA_CANCELADA';
    throw err;
  }
  return prisma.multa.update({ where: { id: Number(id) }, data: { status: 'CANCELADO' } });
}

async function deletar(id) {
  await buscarPorId(id);
  return prisma.multa.delete({ where: { id: Number(id) } });
}

module.exports = { listar, buscarPorId, buscarPorUsuario, listarPendentes, criar, atualizar, pagar, cancelar, deletar };
