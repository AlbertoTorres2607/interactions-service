// src/mq/connection.js
const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const EXCHANGE = process.env.RMQ_EXCHANGE || "post.interactions"; // mismo nombre en Posts

let _conn, _ch;

async function getChannel() {
  if (_ch) return _ch;
  _conn = await amqp.connect(RABBITMQ_URL);
  _ch = await _conn.createChannel();
  await _ch.assertExchange(EXCHANGE, "direct", { durable: true });
  return _ch;
}

async function close() {
  try { await _ch?.close(); } catch {}
  try { await _conn?.close(); } catch {}
  _ch = null; _conn = null;
}

module.exports = { getChannel, close, EXCHANGE };
