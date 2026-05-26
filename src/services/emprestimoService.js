/**
 * src/services/emprestimoService.js
 *
 * Integração com o microsserviço de Catálogo:
 *   - Antes de criar um empréstimo, valida o livroId e exemplarId no Catálogo via HTTP.
 *   - Após criar, notifica o Catálogo para marcar o exemplar como "Emprestado".
 *   - Após devolução, notifica o Catálogo para liberar o exemplar como "Disponivel".
 */

const prisma      = require('../utils/prisma');
const { addDays } = require('../utils/dateHelper');
const { publish, EVENTS } = require('../config/rabbitmq');
const catalogo    = require('../config/catalogoClient');
const usuario     = require('../config/usuarioClient');
const reserva     = require('../config/reservaClient');

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
    err.statusCode = 404;
    err.code = 'EMPRESTIMO_NAO_ENCONTRADO';
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
  const where = {
    emprestimo_status: 'Ativo',
    emprestimo_data_prevista_devolucao: { lt: new Date() },
  };

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

async function criar({ usuarioId, livroId, exemplarId, diasPrazo = 14 }) {
  // ── Validação de campos obrigatórios ─────────────────────────────────────
  if (!usuarioId || !livroId || !exemplarId) {
    const err = new Error('usuarioId, livroId e exemplarId são obrigatórios.');
    err.statusCode = 400;
    err.code = 'DADOS_INVALIDOS';
    throw err;
  }

  // ── 1. Valida se o usuário existe e está ativo no microsserviço de Usuário ─
  const usuarioData = await usuario.buscarUsuario(usuarioId);
  console.log(`[Emprestimo] Usuário validado: "${usuarioData.usuario_nome}" (ID: ${usuarioId}, status: ${usuarioData.usuario_status})`);

  // ── 2. Valida se o livro existe e está ativo no Catálogo ─────────────────
  const livro = await catalogo.buscarLivro(livroId);
  console.log(`[Emprestimo] Livro validado no Catálogo: "${livro.titulo || livro.livro_titulo}" (ID: ${livroId})`);

  // ── 3. Valida se o exemplar existe e está disponível no Catálogo ──────────
  const exemplar = await catalogo.buscarExemplar(exemplarId);
  console.log(`[Emprestimo] Exemplar validado no Catálogo: ${exemplar.codigoBarras || exemplar.exemplar_codigo_barras} (ID: ${exemplarId})`);

  // ── 4. Verifica se o exemplar já tem empréstimo ativo aqui no banco ───────
  const ativo = await prisma.itemEmprestimo.findFirst({
    where: {
      exemplar_id: Number(exemplarId),
      emprestimo: { emprestimo_status: 'Ativo' },
    },
  });

  if (ativo) {
    const err = new Error('Este exemplar já está registrado como emprestado no sistema.');
    err.statusCode = 409;
    err.code = 'EXEMPLAR_INDISPONIVEL';
    throw err;
  }

  // ── 4b. Verifica reservas ativas para este livro no microsserviço de Reserva ─
  // Se o próprio usuário tem reserva ativa: permite e cancela ao final.
  // Se outro usuário tem reserva e o solicitante não tem: bloqueia para respeitar a fila.
  const reservaDoUsuario = await reserva.buscarReservaAtivaDoUsuario(usuarioId, livroId);

  if (!reservaDoUsuario) {
    // Usuário não tem reserva — verifica se há fila de outros usuários
    const fila = await reserva.buscarFilaReservasLivro(livroId);
    if (fila && fila.length > 0) {
      const err = new Error(
        `Existe(m) ${fila.length} reserva(s) ativa(s) para este livro. ` +
        'O empréstimo direto não é permitido — realize uma reserva primeiro.'
      );
      err.statusCode = 409;
      err.code = 'LIVRO_COM_RESERVAS_ATIVAS';
      throw err;
    }
  }

  // ── 5. Cria o empréstimo ──────────────────────────────────────────────────
  const hoje  = new Date();
  const prazo = addDays(hoje, diasPrazo);

  const emprestimo = await prisma.emprestimo.create({
    data: {
      usuario_id:                         Number(usuarioId),
      emprestimo_data_emprestimo:         hoje,
      emprestimo_data_prevista_devolucao: prazo,
      emprestimo_status:                  'Ativo',
      itens: {
        create: {
          exemplar_id:               Number(exemplarId),
          item_emprestimo_quantidade: 1,
        },
      },
    },
    include: { itens: true },
  });

  // ── 6. Notifica o Catálogo para marcar o exemplar como "Emprestado" ───────
  // Chamada HTTP direta (síncrona mas com falha silenciosa).
  // O evento RabbitMQ abaixo serve de fallback caso o HTTP falhe.
  await catalogo.marcarExemplarComoEmprestado(exemplarId);

  // ── 6b. Cancela a reserva ativa do usuário para este livro (se existir) ───
  if (reservaDoUsuario) {
    await reserva.cancelarReserva(
      reservaDoUsuario.reserva_id,
      `Empréstimo ${emprestimo.emprestimo_id} criado`
    );
    console.log(`[Emprestimo] Reserva ${reservaDoUsuario.reserva_id} cancelada ao concretizar empréstimo.`);
  }

  // ── 7. Publica evento no RabbitMQ (para outros microsserviços) ────────────
  await publish(EVENTS.EMPRESTIMO_CRIADO, {
    emprestimoId: emprestimo.emprestimo_id,
    usuarioId:    Number(usuarioId),
    livroId:      Number(livroId),
    exemplarId:   Number(exemplarId),
    dataPrazo:    prazo,
    timestamp:    new Date().toISOString(),
  });

  return emprestimo;
}

async function renovar(id, { diasAdicionais = 7 }) {
  const emp = await buscarPorId(id);

  if (emp.emprestimo_status !== 'Ativo') {
    const err = new Error('Somente empréstimos Ativos podem ser renovados.');
    err.statusCode = 422;
    err.code = 'EMPRESTIMO_NAO_RENOVAVEL';
    throw err;
  }

  const novaData = addDays(emp.emprestimo_data_prevista_devolucao, diasAdicionais);

  const atualizado = await prisma.emprestimo.update({
    where: { emprestimo_id: Number(id) },
    data: { emprestimo_data_prevista_devolucao: novaData },
  });

  await publish(EVENTS.EMPRESTIMO_RENOVADO, {
    emprestimoId:    Number(id),
    usuarioId:       emp.usuario_id,
    novaDataPrazo:   novaData,
    diasAdicionados: diasAdicionais,
    timestamp:       new Date().toISOString(),
  });

  return atualizado;
}

async function deletar(id) {
  const emp = await buscarPorId(id);

  await prisma.emprestimo.delete({ where: { emprestimo_id: Number(id) } });

  await publish(EVENTS.EMPRESTIMO_DELETADO, {
    emprestimoId: Number(id),
    usuarioId:    emp.usuario_id,
    timestamp:    new Date().toISOString(),
  });
}

module.exports = {
  listar,
  buscarPorId,
  buscarPorUsuario,
  listarAtivos,
  listarAtrasados,
  criar,
  renovar,
  deletar,
};
