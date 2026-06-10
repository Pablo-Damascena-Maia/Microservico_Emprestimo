/**
 * src/services/devolucaoService.js
 *
 * Na devolução, além de atualizar o empréstimo e gerar multa,
 * notifica o Catálogo para liberar o exemplar como "Disponivel".
 */

const prisma        = require('../utils/prisma');
const { diffDays }  = require('../utils/dateHelper');
const { publish, EVENTS } = require('../config/rabbitmq');
const catalogo      = require('../config/catalogoClient');
const reserva       = require('../config/reservaClient');

const VALOR_MULTA_DIA = Number(process.env.VALOR_MULTA_DIA) || 2.50;

async function listar({ page = 1, limit = 20 }) {
  const [total, data] = await Promise.all([
    prisma.devolucao.count(),
    prisma.devolucao.findMany({
      include: { emprestimo: { include: { itens: true } }, multa: true },
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
    include: { emprestimo: { include: { itens: true } }, multa: true },
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
    where: { emprestimo_id: Number(emprestimoId) },
    include: { emprestimo: { include: { itens: true } }, multa: true },
  });

  if (!devolucao) {
    const err = new Error('Nenhuma devolução encontrada para este empréstimo.');
    err.statusCode = 404;
    err.code = 'DEVOLUCAO_NAO_ENCONTRADA';
    throw err;
  }
  return devolucao;
}

async function registrar({ emprestimoId, dataDevolucao }) {
  if (!emprestimoId) {
    const err = new Error('emprestimoId é obrigatório.');
    err.statusCode = 400;
    err.code = 'DADOS_INVALIDOS';
    throw err;
  }

  const resultado = await prisma.$transaction(async (tx) => {
    // 1. Carrega o empréstimo com seus itens (para saber o exemplarId)
    const emp = await tx.emprestimo.findUnique({
      where: { emprestimo_id: Number(emprestimoId) },
      include: { itens: true },
    });

    if (!emp) {
      const err = new Error('Empréstimo não encontrado.');
      err.statusCode = 404;
      err.code = 'EMPRESTIMO_NAO_ENCONTRADO';
      throw err;
    }

    if (emp.emprestimo_status === 'Devolvido') {
      const err = new Error('Este empréstimo já foi devolvido.');
      err.statusCode = 409;
      err.code = 'EMPRESTIMO_JA_DEVOLVIDO';
      throw err;
    }

    const dataDevDate  = dataDevolucao ? new Date(dataDevolucao) : new Date();
    const prazo        = new Date(emp.emprestimo_data_prevista_devolucao);

    // Normaliza ambas as datas para meia-noite (ignora hora) para comparação justa
    // já que emprestimo_data_prevista_devolucao é @db.Date (sem hora)
    const prazoNorm    = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());
    const devNorm      = new Date(dataDevDate.getFullYear(), dataDevDate.getMonth(), dataDevDate.getDate());

    const houve_atraso = devNorm > prazoNorm;
    const diasAtraso   = houve_atraso ? diffDays(devNorm, prazoNorm) : 0;
    const valorMulta   = diasAtraso * VALOR_MULTA_DIA;

    // 2. Cria a multa (mesmo que seja zero/cancelada)
    const multa = await tx.multa.create({
      data: {
        multa_valor:        valorMulta,
        multa_status:       houve_atraso ? 'Pendente' : 'Cancelada',
        multa_data_geracao: new Date(),
      },
    });

    // 3. Cria o registro de devolução
    const devolucao = await tx.devolucao.create({
      data: {
        emprestimo_id:            emp.emprestimo_id,
        devolucao_data_devolucao: dataDevDate,
        devolucao_atraso_dias:    diasAtraso,
        devolucao_possui_multa:   houve_atraso ? 1 : 0,
        devolucao_status:         1,
        multa_id:                 multa.multa_id,
      },
    });

    // 4. Atualiza o status do empréstimo para Devolvido
    // A multa já registra a penalidade — o empréstimo deve ser marcado como concluído
    await tx.emprestimo.update({
      where: { emprestimo_id: emp.emprestimo_id },
      data: { emprestimo_status: 'Devolvido' },
    });

    return { devolucao, multa, emp, diasAtraso, houve_atraso, valorMulta };
  });

  const { devolucao, multa, emp, diasAtraso, houve_atraso, valorMulta } = resultado;

  // ── 5. Notifica o Catálogo para liberar o exemplar ────────────────────────
  // Recupera o exemplarId do primeiro item do empréstimo
  const exemplarId = emp.itens?.[0]?.exemplar_id;

  if (exemplarId) {
    await catalogo.marcarExemplarComoDisponivel(exemplarId);
  }

  // ── 5b. Recupera o livroId via Catálogo para notificar fila de reservas ───
  // O livroId não é armazenado no banco de empréstimos, apenas o exemplarId.
  // Busca o livroId no Catálogo para incluir no evento e permitir que o
  // microsserviço de Reserva identifique e notifique o próximo da fila.
  let livroId = null;
  if (exemplarId) {
    try {
      const exemplarData = await catalogo.buscarExemplar(exemplarId);
      livroId = exemplarData?.livro_id ?? exemplarData?.livroId ?? null;
      if (livroId) {
        // Notifica diretamente via HTTP o próximo da fila de reservas
        await reserva.notificarProximoDaFila(livroId, exemplarId);
      }
    } catch (err) {
      console.warn('[Devolucao] Falha ao buscar livroId no Catálogo para notificar reservas:', err.message);
    }
  }

  // ── 6. Publica eventos no RabbitMQ ────────────────────────────────────────
  await publish(EVENTS.DEVOLUCAO_REGISTRADA, {
    devolucaoId:   devolucao.devolucao_id,
    emprestimoId:  emp.emprestimo_id,
    usuarioId:     emp.usuario_id,
    exemplarId:    exemplarId || null,
    livroId:       livroId || null,
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
      exemplarId:   exemplarId || null,
      valor:        valorMulta,
      diasAtraso,
      timestamp:    new Date().toISOString(),
    });
  }

  return { ...devolucao, multa };
}

module.exports = { listar, buscarPorId, buscarPorEmprestimo, registrar };
