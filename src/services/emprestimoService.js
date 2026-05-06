const prisma      = require('../utils/prisma');
const { addDays } = require('../utils/dateHelper');
const { publish, EVENTS } = require('../config/rabbitmq');

async function listar({ status, page = 1, limit = 20, orderBy = 'emprestimo_data_emprestimo' }) {
  const where = {};
  if (status) where.emprestimo_status = status;
  const camposValidos = ['emprestimo_data_emprestimo', 'emprestimo_data_prevista_devolucao'];
  const ordem = camposValidos.includes(orderBy) ? orderBy : 'emprestimo_data_emprestimo';
  const [total, data] = await Promise.all([
    prisma.emprestimo.count({ where }),
    prisma.emprestimo.findMany({
      where,
      include: { itens: true, devolucao: true },
      orderBy: { [ordem]: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function buscarPorId(id) {
  const emprestimo = await prisma.emprestimo.findUnique({
    where: { emprestimo_id: Number(id) },
    include: { itens: true, devolucao: { include: { multa: true } } },
  });
  if (!emprestimo) {
    const err = new Error('Empréstimo não encontrado.');
    err.statusCode = 404; err.code = 'EMPRESTIMO_NAO_ENCONTRADO';
    throw err;
  }
  return emprestimo;
}

async function buscarPorUsuario(usuarioId, { page = 1, limit = 20 }) {
  const where = { usuario_id: Number(usuarioId) };
  const [total, data] = await Promise.all([
    prisma.emprestimo.count({ where }),
    prisma.emprestimo.findMany({
      where,
      include: { itens: true, devolucao: true },
      orderBy: { emprestimo_data_emprestimo: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function listarAtivos({ page = 1, limit = 20 }) {
  const where = { emprestimo_status: 'Ativo' };
  const [total, data] = await Promise.all([
    prisma.emprestimo.count({ where }),
    prisma.emprestimo.findMany({
      where,
      include: { itens: true },
      orderBy: { emprestimo_data_prevista_devolucao: 'asc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function listarAtrasados({ page = 1, limit = 20 }) {
  const where = { emprestimo_status: 'Ativo', emprestimo_data_prevista_devolucao: { lt: new Date() } };
  const [total, data] = await Promise.all([
    prisma.emprestimo.count({ where }),
    prisma.emprestimo.findMany({
      where,
      include: { itens: true, devolucao: true },
      orderBy: { emprestimo_data_prevista_devolucao: 'asc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function criar({ usuarioId, exemplarId, diasPrazo = 14 }) {
  if (!usuarioId || !exemplarId) {
    const err = new Error('usuarioId e exemplarId são obrigatórios.');
    err.statusCode = 400; err.code = 'DADOS_INVALIDOS'; throw err;
  }
  const ativo = await prisma.itemEmprestimo.findFirst({
    where: { exemplar_id: Number(exemplarId), emprestimo: { emprestimo_status: 'Ativo' } },
  });
  if (ativo) {
    const err = new Error('Este exemplar já está emprestado.');
    err.statusCode = 409; err.code = 'EXEMPLAR_INDISPONIVEL'; throw err;
  }
  const hoje = new Date();
  const prazo = addDays(hoje, diasPrazo);
  const emprestimo = await prisma.emprestimo.create({
    data: {
      usuario_id: Number(usuarioId),
      emprestimo_data_emprestimo: hoje,
      emprestimo_data_prevista_devolucao: prazo,
      emprestimo_status: 'Ativo',
      itens: { create: { exemplar_id: Number(exemplarId), item_emprestimo_quantidade: 1 } },
    },
    include: { itens: true },
  });
  await publish(EVENTS.EMPRESTIMO_CRIADO, {
    emprestimoId: emprestimo.emprestimo_id,
    usuarioId: emprestimo.usuario_id,
    exemplarId: Number(exemplarId),
    dataPrazo: prazo,
    timestamp: new Date().toISOString(),
  });
  return emprestimo;
}

async function renovar(id, { diasAdicionais = 7 }) {
  const emp = await buscarPorId(id);
  if (emp.emprestimo_status !== 'Ativo') {
    const err = new Error('Somente empréstimos Ativos podem ser renovados.');
    err.statusCode = 422; err.code = 'EMPRESTIMO_NAO_RENOVAVEL'; throw err;
  }
  const novaData = addDays(emp.emprestimo_data_prevista_devolucao, diasAdicionais);
  const atualizado = await prisma.emprestimo.update({
    where: { emprestimo_id: Number(id) },
    data: { emprestimo_data_prevista_devolucao: novaData },
  });
  await publish(EVENTS.EMPRESTIMO_RENOVADO, {
    emprestimoId: Number(id),
    usuarioId: emp.usuario_id,
    novaDataPrazo: novaData,
    diasAdicionados: diasAdicionais,
    timestamp: new Date().toISOString(),
  });
  return atualizado;
}

async function deletar(id) {
  const emp = await buscarPorId(id);
  await prisma.emprestimo.delete({ where: { emprestimo_id: Number(id) } });
  await publish(EVENTS.EMPRESTIMO_DELETADO, {
    emprestimoId: Number(id),
    usuarioId: emp.usuario_id,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { listar, buscarPorId, buscarPorUsuario, listarAtivos, listarAtrasados, criar, renovar, deletar };
