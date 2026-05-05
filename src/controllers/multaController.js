const service = require('../services/multaService');

async function listar(req, reply) {
  const result = await service.listar(req.query);
  return reply.code(200).send({ success: true, ...result });
}

async function buscarPorId(req, reply) {
  const data = await service.buscarPorId(req.params.id);
  return reply.code(200).send({ success: true, data });
}

async function buscarPorUsuario(req, reply) {
  const result = await service.buscarPorUsuario(req.params.usuarioId, req.query);
  return reply.code(200).send({ success: true, ...result });
}

async function listarPendentes(req, reply) {
  const result = await service.listarPendentes(req.query);
  return reply.code(200).send({ success: true, ...result });
}

async function criar(req, reply) {
  const data = await service.criar(req.body);
  return reply.code(201).send({ success: true, data });
}

async function atualizar(req, reply) {
  const data = await service.atualizar(req.params.id, req.body);
  return reply.code(200).send({ success: true, data });
}

async function pagar(req, reply) {
  const data = await service.pagar(req.params.id, req.body);
  return reply.code(200).send({ success: true, data });
}

async function cancelar(req, reply) {
  const data = await service.cancelar(req.params.id);
  return reply.code(200).send({ success: true, data });
}

async function deletar(req, reply) {
  await service.deletar(req.params.id);
  return reply.code(204).send();
}

module.exports = { listar, buscarPorId, buscarPorUsuario, listarPendentes, criar, atualizar, pagar, cancelar, deletar };
