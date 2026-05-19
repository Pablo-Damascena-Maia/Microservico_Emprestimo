/**
 * src/config/rabbitmq.js
 *
 * Gerencia a conexão persistente com o RabbitMQ.
 * Reconecta automaticamente em caso de queda.
 */

const amqplib = require('amqplib');

// Fallback aponta para o servidor real da faculdade
const RABBITMQ_URL       = process.env.RABBITMQ_URL || 'amqp://admin:adminadmin@10.136.38.50:5672';
const RECONNECT_DELAY_MS = Number(process.env.RABBITMQ_RECONNECT_DELAY) || 5000;
const EXCHANGE           = 'biblioteca';
const EXCHANGE_TYPE      = 'topic';

let connection = null;
let channel    = null;
let connecting = false;

async function connect() {
  if (connecting) return;
  connecting = true;

  try {
    console.log('[RabbitMQ] Conectando em', RABBITMQ_URL.replace(/:\/\/.*@/, '://***@'));
    connection = await amqplib.connect(RABBITMQ_URL);
    channel    = await connection.createChannel();

    await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });

    console.log('[RabbitMQ] Conectado. Exchange:', EXCHANGE);
    connecting = false;

    connection.on('close', () => {
      console.warn('[RabbitMQ] Conexão encerrada. Reconectando em', RECONNECT_DELAY_MS, 'ms...');
      connection = null;
      channel    = null;
      connecting = false;
      setTimeout(connect, RECONNECT_DELAY_MS);
    });

    connection.on('error', (err) => {
      console.error('[RabbitMQ] Erro na conexão:', err.message);
    });

  } catch (err) {
    connecting = false;
    console.error('[RabbitMQ] Falha ao conectar:', err.message, '— tentando novamente em', RECONNECT_DELAY_MS, 'ms');
    setTimeout(connect, RECONNECT_DELAY_MS);
  }
}

async function publish(routingKey, payload) {
  if (!channel) {
    console.warn('[RabbitMQ] Canal indisponível. Evento não publicado:', routingKey);
    return false;
  }
  try {
    const buffer = Buffer.from(JSON.stringify(payload));
    channel.publish(EXCHANGE, routingKey, buffer, {
      persistent:  true,
      contentType: 'application/json',
      timestamp:   Math.floor(Date.now() / 1000),
      appId:       'biblioteca-emprestimo',
    });
    console.log('[RabbitMQ] Publicado:', routingKey, payload);
    return true;
  } catch (err) {
    console.error('[RabbitMQ] Erro ao publicar:', err.message);
    return false;
  }
}

async function close() {
  try {
    if (channel)    await channel.close();
    if (connection) await connection.close();
    console.log('[RabbitMQ] Conexão encerrada com segurança.');
  } catch (_) {}
}

const EVENTS = {
  EMPRESTIMO_CRIADO:    'biblioteca.emprestimo.criado',
  EMPRESTIMO_RENOVADO:  'biblioteca.emprestimo.renovado',
  EMPRESTIMO_DELETADO:  'biblioteca.emprestimo.deletado',
  DEVOLUCAO_REGISTRADA: 'biblioteca.devolucao.registrada',
  MULTA_CRIADA:         'biblioteca.multa.criada',
  MULTA_PAGA:           'biblioteca.multa.paga',
  MULTA_CANCELADA:      'biblioteca.multa.cancelada',
};

module.exports = { connect, publish, close, EVENTS };
