/**
 * src/config/usuarioClient.js
 *
 * Cliente HTTP para comunicação com o microsserviço de Usuário.
 * Usado para validar o usuário antes de criar um empréstimo.
 *
 * Usuário roda na porta 9501.
 * Endpoints consultados:
 *   GET /biblioteca/usuarios/:id
 */

const USUARIO_URL = process.env.USUARIO_URL || 'http://localhost:9501';

/**
 * Busca um usuário pelo ID no microsserviço de Usuário.
 * Retorna os dados do usuário ou lança erro se não encontrado/inativo.
 */
async function buscarUsuario(usuarioId) {
  const url = `${USUARIO_URL}/biblioteca/usuarios/${usuarioId}`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    const error = new Error('Microsserviço de Usuário indisponível. Tente novamente mais tarde.');
    error.statusCode = 503;
    error.code = 'USUARIO_SERVICE_INDISPONIVEL';
    throw error;
  }

  if (res.status === 404) {
    const error = new Error(`Usuário com ID ${usuarioId} não encontrado.`);
    error.statusCode = 404;
    error.code = 'USUARIO_NAO_ENCONTRADO';
    throw error;
  }

  if (!res.ok) {
    const error = new Error(`Erro ao consultar o microsserviço de Usuário (status ${res.status}).`);
    error.statusCode = 502;
    error.code = 'USUARIO_SERVICE_ERRO';
    throw error;
  }

  const body = await res.json();
  // O microsserviço de Usuário retorna { data: { ... } } ou direto o objeto
  const usuario = body.data || body;

  // Verifica se o usuário está ativo
  if (usuario.usuario_status && usuario.usuario_status !== 'Ativo') {
    const error = new Error(
      `Usuário com ID ${usuarioId} está ${usuario.usuario_status} e não pode realizar empréstimos.`
    );
    error.statusCode = 422;
    error.code = 'USUARIO_INATIVO';
    throw error;
  }

  return usuario;
}

module.exports = { buscarUsuario };
