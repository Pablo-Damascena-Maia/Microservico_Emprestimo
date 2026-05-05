const prisma       = require('../utils/prisma');
const { diffDays } = require('../utils/dateHelper');

const VALOR_MULTA_DIA = Number(process.env.VALOR_MULTA_DIA) || 2.50;

async function listar({ page = 1, limit = 20 }) {
  const [total, data] = await Promise.all([
    prisma.devolucao.count(),
    prisma.devolucao.findMany({
      include: { emprestimo: true },
      orderBy: { criadaEm: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function buscarPorId(id) {
  const devolucao = await prisma.devolucao.findUnique({
    where: { id: Number(id) },
    include: { emprestimo: { include: { multa: true } } },
  });
  if (!devolucao) {
    const err = new Error('Devolução não encontrada.');
    err.statusCode = 404;
    err.code = 'DEVOLUCAO_NAO_ENCONTRADA';
    throw err;
  }
  return devolucao;
}

async function buscarPorEmprestimo(emprestimoId) {
  const devolucao = await prisma.devolucao.findUnique({
    where: { emprestimoId: Number(emprestimoId) },
    include: { emprestimo: true },
  });
  if (!devolucao) {
    const err = new Error('Nenhuma devolução encontrada para este empréstimo.');
    err.statusCode = 404;
    err.code = 'DEVOLUCAO_NAO_ENCONTRADA';
    throw err;
  }
  return devolucao;
}

async function buscarPorUsuario(usuarioId, { page = 1, limit = 20 }) {
  const where = { emprestimo: { usuarioId: Number(usuarioId) } };
  const [total, data] = await Promise.all([
    prisma.devolucao.count({ where }),
    prisma.devolucao.findMany({
      where,
      include: { emprestimo: true },
      orderBy: { criadaEm: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function registrar({ emprestimoId, dataDevolucao, condicaoLivro }) {
  if (!emprestimoId || !dataDevolucao || !condicaoLivro) {
    const err = new Error('emprestimoId, dataDevolucao e condicaoLivro são obrigatórios.');
    err.statusCode = 400;
    err.code = 'DADOS_INVALIDOS';
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const emp = await tx.emprestimo.findUnique({ where: { id: Number(emprestimoId) } });

    if (!emp) {
      const err = new Error('Empréstimo não encontrado.');
      err.statusCode = 404;
      err.code = 'EMPRESTIMO_NAO_ENCONTRADO';
      throw err;
    }
    if (emp.status === 'DEVOLVIDO') {
      const err = new Error('Este empréstimo já foi devolvido.');
      err.statusCode = 409;
      err.code = 'EMPRESTIMO_JA_DEVOLVIDO';
      throw err;
    }

    await tx.emprestimo.update({ where: { id: emp.id }, data: { status: 'DEVOLVIDO' } });

    const devolucao = await tx.devolucao.create({
      data: {
        emprestimoId:  emp.id,
        dataDevolucao: new Date(dataDevolucao),
        condicaoLivro,
      },
    });

    // Gera multa automaticamente se houve atraso
    const dataDevDate = new Date(dataDevolucao);
    if (dataDevDate > emp.dataPrazo) {
      const dias = diffDays(dataDevDate, emp.dataPrazo);
      await tx.multa.create({
        data: {
          emprestimoId: emp.id,
          diasAtraso:   dias,
          valor:        dias * VALOR_MULTA_DIA,
          motivo:       'ATRASO',
          status:       'PENDENTE',
        },
      });
    }

    return devolucao;
  });
}

async function confirmar(id, { bibliotecarioId, observacao }) {
  await buscarPorId(id);
  return prisma.devolucao.update({
    where: { id: Number(id) },
    data: {
      confirmadoPor: bibliotecarioId ? Number(bibliotecarioId) : undefined,
      observacao:    observacao ?? undefined,
      confirmadoEm:  new Date(),
    },
  });
}

module.exports = { listar, buscarPorId, buscarPorEmprestimo, buscarPorUsuario, registrar, confirmar };
