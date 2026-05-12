const ctrl = require('../controllers/devolucaoController');

async function devolucaoRoutes(fastify) {
  fastify.get('/',                  ctrl.listar); //devolucoes
  fastify.get('/emprestimo/:empId', ctrl.buscarPorEmprestimo);
  fastify.get('/:id',               ctrl.buscarPorId);
  fastify.post('/',                  ctrl.registrar);
}

module.exports = devolucaoRoutes;
