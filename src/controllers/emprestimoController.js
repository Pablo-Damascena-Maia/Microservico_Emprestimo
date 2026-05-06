const service = require('../services/emprestimoService');

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

async function listarAtivos(req, reply) {
  const result = await service.listarAtivos(req.query);
  return reply.code(200).send({ success: true, ...result });
}

async function listarAtrasados(req, reply) {
  const result = await service.listarAtrasados(req.query);
  return reply.code(200).send({ success: true, ...result });
}

async function criar(req, reply) {
  const data = await service.criar(req.body);
  return reply.code(201).send({ success: true, data });
}

async function renovar(req, reply) {
  const data = await service.renovar(req.params.id, req.body);
  return reply.code(200).send({ success: true, data });
}

async function deletar(req, reply) {
  await service.deletar(req.params.id);
  return reply.code(204).send();
}

module.exports = { listar, buscarPorId, buscarPorUsuario, listarAtivos, listarAtrasados, criar, renovar, deletar };
