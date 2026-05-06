const prisma       = require('../utils/prisma');
const { diffDays } = require('../utils/dateHelper');
const { publish, EVENTS } = require('../config/rabbitmq');

const VALOR_MULTA_DIA = Number(process.env.VALOR_MULTA_DIA) || 2.50;

async function listar({ page = 1, limit = 20 }) {
  const [total, data] = await Promise.all([
    prisma.devolucao.count(),
    prisma.devolucao.findMany({
      include: { emprestimo: true, multa: true },
      orderBy: { devolucao_id: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  return { data, meta: { total, page: Number(page), limit: Number(limit) } };
}

async function buscarPorId(id) {
  const devolucao = await prisma.devolucao.findUnique({
    where: { devolucao_id: Number(id) },
    include: { emprestimo: true, multa: true },
  });
  if (!devolucao) {
    const err = new Error('Devolução não encontrada.');
    err.statusCode = 404; err.code = 'DEVOLUCAO_NAO_ENCONTRADA'; throw err;
  }
  return devolucao;
}

async function buscarPorEmprestimo(emprestimoId) {
  const devolucao = await prisma.devolucao.findUnique({
    where: { emprestimo_id: Number(emprestimoId) },
    include: { emprestimo: true, multa: true },
  });
  if (!devolucao) {
    const err = new Error('Nenhuma devolução encontrada para este empréstimo.');
    err.statusCode = 404; err.code = 'DEVOLUCAO_NAO_ENCONTRADA'; throw err;
  }
  return devolucao;
}

async function registrar({ emprestimoId, dataDevolucao }) {
  if (!emprestimoId) {
    const err = new Error('emprestimoId é obrigatório.');
    err.statusCode = 400; err.code = 'DADOS_INVALIDOS'; throw err;
  }

  return prisma.$transaction(async (tx) => {
    const emp = await tx.emprestimo.findUnique({ where: { emprestimo_id: Number(emprestimoId) } });
    if (!emp) {
      const err = new Error('Empréstimo não encontrado.');
      err.statusCode = 404; err.code = 'EMPRESTIMO_NAO_ENCONTRADO'; throw err;
    }
    if (emp.emprestimo_status === 'Devolvido') {
      const err = new Error('Este empréstimo já foi devolvido.');
      err.statusCode = 409; err.code = 'EMPRESTIMO_JA_DEVOLVIDO'; throw err;
    }

    const dataDevDate  = dataDevolucao ? new Date(dataDevolucao) : new Date();
    const prazo        = emp.emprestimo_data_prevista_devolucao;
    const houve_atraso = dataDevDate > prazo;
    const diasAtraso   = houve_atraso ? diffDays(dataDevDate, prazo) : 0;
    const valorMulta   = diasAtraso * VALOR_MULTA_DIA;

    const multa = await tx.multa.create({
      data: {
        multa_valor:        valorMulta,
        multa_status:       houve_atraso ? 'Pendente' : 'Cancelada',
        multa_data_geracao: new Date(),
      },
    });

    const devolucao = await tx.devolucao.create({
      data: {
        emprestimo_id:           emp.emprestimo_id,
        devolucao_data_devolucao: dataDevDate,
        devolucao_atraso_dias:   diasAtraso,
        devolucao_possui_multa:  houve_atraso ? 1 : 0,
        devolucao_status:        1,
        multa_id:                multa.multa_id,
      },
    });

    await tx.emprestimo.update({
      where: { emprestimo_id: emp.emprestimo_id },
      data: { emprestimo_status: houve_atraso ? 'Atrasado' : 'Devolvido' },
    });

    // Publica eventos no RabbitMQ
    await publish(EVENTS.DEVOLUCAO_REGISTRADA, {
      devolucaoId:   devolucao.devolucao_id,
      emprestimoId:  emp.emprestimo_id,
      usuarioId:     emp.usuario_id,
      diasAtraso,
      possuiMulta:   houve_atraso,
      multaId:       multa.multa_id,
      valorMulta,
      timestamp:     new Date().toISOString(),
    });

    if (houve_atraso) {
      await publish(EVENTS.MULTA_CRIADA, {
        multaId:      multa.multa_id,
        emprestimoId: emp.emprestimo_id,
        usuarioId:    emp.usuario_id,
        valor:        valorMulta,
        diasAtraso,
        timestamp:    new Date().toISOString(),
      });
    }

    return { ...devolucao, multa };
  });
}

module.exports = { listar, buscarPorId, buscarPorEmprestimo, registrar };
