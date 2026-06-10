/**
 * src/config/catalogoClient.js
 *
 * Cliente HTTP para comunicação com o microsserviço de Catálogo.
 * Usado para validar livros e exemplares antes de criar um empréstimo.
 *
 * Catálogo roda na porta 9502.
 * Endpoints consultados:
 *   GET /catalogo/livros/:id
 *   GET /catalogo/exemplares/:id
 */



/**
 * Busca um livro pelo ID no microsserviço de Catálogo.
 * Retorna os dados do livro ou lança erro se não encontrado/indisponível.
 */
async function buscarLivro(livroId) {
  const CATALOGO_URL = process.env.CATALOGO_URL || 'http://localhost:9502';
  const url = `${CATALOGO_URL}/livros/${livroId}`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    const error = new Error('Microsserviço de Catálogo indisponível. Tente novamente mais tarde.');
    error.statusCode = 503;
    error.code = 'CATALOGO_INDISPONIVEL';
    throw error;
  }

  if (res.status === 404) {
    const error = new Error(`Livro com ID ${livroId} não encontrado no Catálogo.`);
    error.statusCode = 404;
    error.code = 'LIVRO_NAO_ENCONTRADO';
    throw error;
  }

  if (!res.ok) {
    const error = new Error(`Erro ao consultar o Catálogo (status ${res.status}).`);
    error.statusCode = 502;
    error.code = 'CATALOGO_ERRO';
    throw error;
  }

  const livro = await res.json();

  // Verifica se o livro está ativo (livro_status = 1)
  if (livro.livro_status !== undefined && livro.livro_status !== 1) {
    const error = new Error(`Livro com ID ${livroId} está inativo no Catálogo e não pode ser emprestado.`);
    error.statusCode = 422;
    error.code = 'LIVRO_INATIVO';
    throw error;
  }

  return livro;
}

/**
 * Busca um exemplar pelo ID no microsserviço de Catálogo.
 * Retorna os dados do exemplar ou lança erro se não encontrado/indisponível.
 */
async function buscarExemplar(exemplarId) {
  const CATALOGO_URL = process.env.CATALOGO_URL || 'http://localhost:9502';
  const url = `${CATALOGO_URL}/exemplares/${exemplarId}`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    const error = new Error('Microsserviço de Catálogo indisponível. Tente novamente mais tarde.');
    error.statusCode = 503;
    error.code = 'CATALOGO_INDISPONIVEL';
    throw error;
  }

  if (res.status === 404) {
    const error = new Error(`Exemplar com ID ${exemplarId} não encontrado no Catálogo.`);
    error.statusCode = 404;
    error.code = 'EXEMPLAR_NAO_ENCONTRADO';
    throw error;
  }

  if (!res.ok) {
    const error = new Error(`Erro ao consultar exemplar no Catálogo (status ${res.status}).`);
    error.statusCode = 502;
    error.code = 'CATALOGO_ERRO';
    throw error;
  }

  const exemplar = await res.json();

  // Verifica se o exemplar está disponível para empréstimo
  if (exemplar.exemplar_status && exemplar.exemplar_status !== 'Disponivel') {
    const error = new Error(
      `Exemplar com ID ${exemplarId} não está disponível (status: ${exemplar.exemplar_status}).`
    );
    error.statusCode = 409;
    error.code = 'EXEMPLAR_NAO_DISPONIVEL';
    throw error;
  }

  return exemplar;
}

/**
 * Notifica o Catálogo para marcar o exemplar como "Emprestado".
 * Chamado após criar o empréstimo com sucesso.
 * Falha silenciosa — não bloqueia o empréstimo, pois o RabbitMQ
 * também emite o evento biblioteca.emprestimo.criado para o Catálogo reagir.
 */
async function marcarExemplarComoEmprestado(exemplarId) {
  const CATALOGO_URL = process.env.CATALOGO_URL || 'http://localhost:9502';
  const url = `${CATALOGO_URL}/exemplares/${exemplarId}/status`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exemplar_status: 'Emprestado' }),
    });

    if (!res.ok) {
      console.warn(
        `[CatalogoClient] Aviso: não foi possível atualizar status do exemplar ${exemplarId} (HTTP ${res.status}). O evento RabbitMQ foi emitido como fallback.`
      );
    } else {
      console.log(`[CatalogoClient] Exemplar ${exemplarId} marcado como Emprestado no Catálogo.`);
    }
  } catch (err) {
    console.warn(
      `[CatalogoClient] Aviso: falha ao notificar Catálogo sobre exemplar ${exemplarId}: ${err.message}. O evento RabbitMQ foi emitido como fallback.`
    );
  }
}

/**
 * Notifica o Catálogo para marcar o exemplar como "Disponivel" após devolução.
 * Também falha silenciosa — o evento RabbitMQ serve como fallback.
 */
async function marcarExemplarComoDisponivel(exemplarId) {
  const CATALOGO_URL = process.env.CATALOGO_URL || 'http://localhost:9502';
  const url = `${CATALOGO_URL}/exemplares/${exemplarId}/status`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exemplar_status: 'Disponivel' }),
    });

    if (!res.ok) {
      console.warn(
        `[CatalogoClient] Aviso: não foi possível liberar exemplar ${exemplarId} (HTTP ${res.status}). O evento RabbitMQ foi emitido como fallback.`
      );
    } else {
      console.log(`[CatalogoClient] Exemplar ${exemplarId} marcado como Disponivel no Catálogo.`);
    }
  } catch (err) {
    console.warn(
      `[CatalogoClient] Aviso: falha ao notificar Catálogo sobre devolução do exemplar ${exemplarId}: ${err.message}.`
    );
  }
}

module.exports = {
  buscarLivro,
  buscarExemplar,
  marcarExemplarComoEmprestado,
  marcarExemplarComoDisponivel,
};
