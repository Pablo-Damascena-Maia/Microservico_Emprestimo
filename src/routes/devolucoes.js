const ctrl = require('../controllers/devolucaoController');

async function devolucaoRoutes(fastify) {
  fastify.get('/',                    ctrl.listar);
  fastify.get('/emprestimo/:empId',   ctrl.buscarPorEmprestimo);
  fastify.get('/usuario/:usuarioId',  ctrl.buscarPorUsuario);
  fastify.get('/:id',                 ctrl.buscarPorId);
  fastify.post('/',                   ctrl.registrar);
  fastify.patch('/:id/confirmar',     ctrl.confirmar);
}

module.exports = devolucaoRoutes;
