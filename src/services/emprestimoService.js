const prisma      = require('../utils/prisma');
const { addDays } = require('../utils/dateHelper');

async function listar({ status, page = 1, limit = 20, orderBy = 'dataCriacao' }) {
  const where = {};
  if (status) where.status = status;

  const camposValidos = ['dataCriacao', 'dataPrazo'];
  const ordem = camposValidos.includes(orderBy) ? orderBy : 'dataCriacao';

  const [total, data] = await Promise.all([
    prisma.emprestimo.count({ where }),
    prisma.emprestimo.findMany({
      where,
      include: { devolucao: true, multa: true },
      orderBy: { [ordem]: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);

  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function buscarPorId(id) {
  const emprestimo = await prisma.emprestimo.findUnique({
    where: { id: Number(id) },
    include: { devolucao: true, multa: true },
  });
  if (!emprestimo) {
    const err = new Error('Empréstimo não encontrado.');
    err.statusCode = 404;
    err.code = 'EMPRESTIMO_NAO_ENCONTRADO';
    throw err;
  }
  return emprestimo;
}

async function buscarPorUsuario(usuarioId, { page = 1, limit = 20 }) {
  const where = { usuarioId: Number(usuarioId) };
  const [total, data] = await Promise.all([
    prisma.emprestimo.count({ where }),
    prisma.emprestimo.findMany({
      where,
      include: { devolucao: true, multa: true },
      orderBy: { dataCriacao: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function buscarPorLivro(livroId, { page = 1, limit = 20 }) {
  const where = { livroId: Number(livroId) };
  const [total, data] = await Promise.all([
    prisma.emprestimo.count({ where }),
    prisma.emprestimo.findMany({
      where,
      include: { devolucao: true, multa: true },
      orderBy: { dataCriacao: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function listarAtivos({ page = 1, limit = 20 }) {
  const where = { status: 'ATIVO' };
  const [total, data] = await Promise.all([
    prisma.emprestimo.count({ where }),
    prisma.emprestimo.findMany({
      where,
      orderBy: { dataPrazo: 'asc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function listarAtrasados({ page = 1, limit = 20 }) {
  const where = { status: 'ATIVO', dataPrazo: { lt: new Date() } };
  const [total, data] = await Promise.all([
    prisma.emprestimo.count({ where }),
    prisma.emprestimo.findMany({
      where,
      include: { multa: true },
      orderBy: { dataPrazo: 'asc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function criar({ usuarioId, livroId, exemplarId, diasPrazo = 14 }) {
  if (!usuarioId || !livroId || !exemplarId) {
    const err = new Error('usuarioId, livroId e exemplarId são obrigatórios.');
    err.statusCode = 400;
    err.code = 'DADOS_INVALIDOS';
    throw err;
  }

  const ativo = await prisma.emprestimo.findFirst({
    where: { exemplarId: Number(exemplarId), status: 'ATIVO' },
  });
  if (ativo) {
    const err = new Error('Este exemplar já está emprestado.');
    err.statusCode = 409;
    err.code = 'EXEMPLAR_INDISPONIVEL';
    throw err;
  }

  return prisma.emprestimo.create({
    data: {
      usuarioId:  Number(usuarioId),
      livroId:    Number(livroId),
      exemplarId: Number(exemplarId),
      dataPrazo:  addDays(new Date(), diasPrazo),
      status:     'ATIVO',
    },
  });
}

async function renovar(id, { diasAdicionais = 7 }) {
  const emp = await buscarPorId(id);
  if (emp.status !== 'ATIVO') {
    const err = new Error('Somente empréstimos ATIVOS podem ser renovados.');
    err.statusCode = 422;
    err.code = 'EMPRESTIMO_NAO_RENOVAVEL';
    throw err;
  }
  return prisma.emprestimo.update({
    where: { id: Number(id) },
    data: { dataPrazo: addDays(emp.dataPrazo, diasAdicionais) },
  });
}

async function deletar(id) {
  await buscarPorId(id);
  return prisma.emprestimo.delete({ where: { id: Number(id) } });
}

module.exports = { listar, buscarPorId, buscarPorUsuario, buscarPorLivro, listarAtivos, listarAtrasados, criar, renovar, deletar };
