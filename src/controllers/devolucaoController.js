const service = require('../services/devolucaoService');

async function listar(req, reply) {
  const result = await service.listar(req.query);
  return reply.code(200).send({ success: true, ...result });
}

async function buscarPorId(req, reply) {
  const data = await service.buscarPorId(req.params.id);
  return reply.code(200).send({ success: true, data });
}

async function buscarPorEmprestimo(req, reply) {
  const data = await service.buscarPorEmprestimo(req.params.empId);
  return reply.code(200).send({ success: true, data });
}

async function buscarPorUsuario(req, reply) {
  const result = await service.buscarPorUsuario(req.params.usuarioId, req.query);
  return reply.code(200).send({ success: true, ...result });
}

async function registrar(req, reply) {
  const data = await service.registrar(req.body);
  return reply.code(201).send({ success: true, data });
}

async function confirmar(req, reply) {
  const data = await service.confirmar(req.params.id, req.body);
  return reply.code(200).send({ success: true, data });
}

module.exports = { listar, buscarPorId, buscarPorEmprestimo, buscarPorUsuario, registrar, confirmar };
