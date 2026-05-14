const ctrl = require('../controllers/multaController');

async function multaRoutes(fastify) {
  fastify.get('/',            ctrl.listar);//multas
  fastify.get('/pendentes',   ctrl.listarPendentes);
  fastify.get('/:id',         ctrl.buscarPorId);
  fastify.post('/',            ctrl.criar);
  fastify.put('/:id',          ctrl.atualizar);
  fastify.patch('/:id/pagar',  ctrl.pagar);
  fastify.patch('/:id/cancelar', ctrl.cancelar);
  fastify.delete('/:id',       ctrl.deletar);
}

module.exports = multaRoutes;
