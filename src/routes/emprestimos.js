const ctrl = require('../controllers/emprestimoController');

async function emprestimoRoutes(fastify) {
  fastify.get('/',                   ctrl.listar);
  fastify.get('/ativos',             ctrl.listarAtivos);
  fastify.get('/atrasados',          ctrl.listarAtrasados);
  fastify.get('/usuario/:usuarioId', ctrl.buscarPorUsuario);
  fastify.get('/livro/:livroId',     ctrl.buscarPorLivro);
  fastify.get('/:id',                ctrl.buscarPorId);
  fastify.post('/',                  ctrl.criar);
  fastify.patch('/:id/renovar',      ctrl.renovar);
  fastify.delete('/:id',             ctrl.deletar);
}

module.exports = emprestimoRoutes;
