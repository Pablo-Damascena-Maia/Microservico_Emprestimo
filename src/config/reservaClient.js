/**
 * src/config/reservaClient.js
 *
 * Cliente HTTP para comunicação com o microsserviço de Reserva.
 *
 * Microsserviço de Reserva roda na porta 9503.
 * Endpoints utilizados:
 *   POST /reserva/validar-conflito   → verifica se há reserva ativa para usuário+livro
 *   GET  /reserva/livro/listar-fila/:livro_id → fila de reservas do livro
 *   GET  /reserva/usuario/listar/:usuario_id  → reservas do usuário
 *   PATCH /reserva/atualizar-status/:id       → cancela reserva ao criar empréstimo
 */



/**
 * Verifica se há reserva ativa do usuário para o livro informado.
 * Retorna { conflito: boolean, count: number, reserva_id?: number }
 */
async function verificarReservaAtiva(usuarioId, livroId) {
  const RESERVA_URL = process.env.RESERVA_URL || 'http://localhost:9503';
  const url = `${RESERVA_URL}/reserva/validar-conflito`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: String(usuarioId), livro_id: Number(livroId) }),
    });
  } catch (err) {
    // Serviço de Reserva indisponível — continua sem bloquear o empréstimo
    console.warn('[ReservaClient] Microsserviço de Reserva indisponível ao verificar conflito:', err.message);
    return { conflito: false, count: 0 };
  }

  if (!res.ok) {
    console.warn(`[ReservaClient] Erro ao verificar reserva (HTTP ${res.status}). Continuando sem bloqueio.`);
    return { conflito: false, count: 0 };
  }

  const body = await res.json();
  return body.data || body;
}

/**
 * Busca a reserva ativa mais antiga do usuário para o livro.
 * Retorna o objeto da reserva ou null.
 */
async function buscarReservaAtivaDoUsuario(usuarioId, livroId) {
  const RESERVA_URL = process.env.RESERVA_URL || 'http://localhost:9503';
  const url = `${RESERVA_URL}/reserva/usuario/listar/${usuarioId}`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.warn('[ReservaClient] Falha ao buscar reservas do usuário:', err.message);
    return null;
  }

  if (!res.ok) return null;

  const body = await res.json();
  const reservas = body.data || body;

  if (!Array.isArray(reservas)) return null;

  // Filtra pela reserva ativa do livro específico (status 1 = ativo)
  return reservas.find(
    (r) => Number(r.livro_id) === Number(livroId) && r.status === 1
  ) || null;
}

/**
 * Cancela uma reserva específica ao concretizar o empréstimo.
 * Falha silenciosa — o empréstimo não é bloqueado se a reserva não puder ser cancelada.
 */
async function cancelarReserva(reservaId, motivo = 'Empréstimo realizado') {
  const RESERVA_URL = process.env.RESERVA_URL || 'http://localhost:9503';
  const url = `${RESERVA_URL}/reserva/atualizar-status/${reservaId}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // O controller/service do microsserviço de Reserva espera o campo
      // "reserva_status" (não "status_novo") na desestruturação do body:
      //   async alterarStatus(id, { reserva_status, motivo }) { ... }
      // Enviar "status_novo" causava reserva_status === undefined →
      // ValidationError no service → HTTP 400 → o caller tratava como
      // falha silenciosa mas o log mostrava o erro. Alinhado aqui.
      body: JSON.stringify({ reserva_status: 0, motivo }),
    });

    if (!res.ok) {
      console.warn(`[ReservaClient] Aviso: não foi possível cancelar reserva ${reservaId} (HTTP ${res.status}).`);
    } else {
      console.log(`[ReservaClient] Reserva ${reservaId} cancelada com sucesso (motivo: ${motivo}).`);
    }
  } catch (err) {
    console.warn(`[ReservaClient] Falha ao cancelar reserva ${reservaId}: ${err.message}.`);
  }
}

/**
 * Busca a fila de reservas ativas para um livro (ordem de criação).
 * Usado após devolução para notificar o próximo da fila.
 * Retorna array de reservas ordenadas por data de criação (mais antigas primeiro).
 */
async function buscarFilaReservasLivro(livroId) {
  const RESERVA_URL = process.env.RESERVA_URL || 'http://localhost:9503';
  const url = `${RESERVA_URL}/reserva/livro/listar-fila/${livroId}`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.warn('[ReservaClient] Falha ao buscar fila de reservas do livro:', err.message);
    return [];
  }

  if (!res.ok) return [];

  const body = await res.json();
  return body.data || body || [];
}

/**
 * Notifica o microsserviço de Reserva que um livro foi devolvido
 * e há um exemplar disponível. Registra uma notificação na reserva mais antiga da fila.
 * Falha silenciosa.
 */
async function notificarProximoDaFila(livroId, exemplarId) {
  const fila = await buscarFilaReservasLivro(livroId);

  if (!fila || fila.length === 0) {
    console.log(`[ReservaClient] Nenhuma reserva ativa na fila para o livro ${livroId}.`);
    return;
  }

  const proxima = fila[0];
  const RESERVA_URL = process.env.RESERVA_URL || 'http://localhost:9503';
  const url = `${RESERVA_URL}/reserva/registrar-notificacao/${proxima.reserva_id}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        motivo: `Exemplar ${exemplarId} disponível para retirada (devolvido).`,
      }),
    });

    if (!res.ok) {
      console.warn(`[ReservaClient] Aviso: não foi possível notificar reserva ${proxima.reserva_id} (HTTP ${res.status}).`);
    } else {
      console.log(`[ReservaClient] Próximo da fila notificado: reserva ${proxima.reserva_id} (usuário ${proxima.usuario_id}).`);
    }
  } catch (err) {
    console.warn(`[ReservaClient] Falha ao notificar próximo da fila: ${err.message}.`);
  }
}

module.exports = {
  verificarReservaAtiva,
  buscarReservaAtivaDoUsuario,
  cancelarReserva,
  buscarFilaReservasLivro,
  notificarProximoDaFila,
};
