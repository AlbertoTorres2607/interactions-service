// src/mq/consumer.js
const { getChannel, EXCHANGE } = require("./connection");
const Comment = require("../models/Comment");
const mongoose = require("mongoose");

// NUEVO: likes sobre posts (colección separada)
const PostLike = require("../models/PostLike"); // la creamos más abajo

async function startConsumers() {
  const ch = await getChannel();
  await ch.prefetch(20);

  // Queues propias del interactions-service
  const likesQ = process.env.RMQ_LIKES_QUEUE || "interactions.likes";
  const commentsQ = process.env.RMQ_COMMENTS_QUEUE || "interactions.comments";

  await ch.assertQueue(likesQ, { durable: true });
  await ch.assertQueue(commentsQ, { durable: true });

  await ch.bindQueue(likesQ, EXCHANGE, "like");
  await ch.bindQueue(commentsQ, EXCHANGE, "comment");

  // LIKE events (sobre POSTS)
  ch.consume(likesQ, async (msg) => {
    if (!msg) return;
    try {
      const evt = JSON.parse(msg.content.toString());
      // evt = { eventId, type: 'POST_LIKED'|'POST_UNLIKED', data: { postId, userId } }
      const { type, data } = evt || {};
      if (!data?.postId || !data?.userId) {
        ch.ack(msg); return;
      }

      if (type === "POST_LIKED") {
        await PostLike.updateOne(
          { postId: String(data.postId), userId: String(data.userId) },
          { $setOnInsert: { postId: String(data.postId), userId: String(data.userId) } },
          { upsert: true }
        );
      } else if (type === "POST_UNLIKED") {
        await PostLike.deleteOne({ postId: String(data.postId), userId: String(data.userId) });
      }

      ch.ack(msg);
    } catch (e) {
      console.error("LIKE event error:", e);
      ch.nack(msg, false, false); // dead-letter si configuras DLX
    }
  });

  // COMMENT events (comentarios nuevos sobre POSTS)
  ch.consume(commentsQ, async (msg) => {
    if (!msg) return;
    try {
      const evt = JSON.parse(msg.content.toString());
      // evt = { eventId, type: 'COMMENT_ADDED', data: { postId, userId, content } }
      const { eventId, type, data } = evt || {};
      if (type !== "COMMENT_ADDED" || !data?.postId || !data?.userId || !data?.content) {
        ch.ack(msg); return;
      }

      // dedupe por eventId (índice único sparse en Comment)
      const doc = {
        postId: String(data.postId),
        authorId: String(data.userId),
        text: String(data.content).slice(0, 2000),
        parentCommentId: null,
        eventId: eventId || null
      };

      // inserta; si se repite eventId, ignora
      await Comment.create(doc).catch(err => {
        if (err?.code === 11000) return; // duplicado eventId
        throw err;
      });

      ch.ack(msg);
    } catch (e) {
      console.error("COMMENT event error:", e);
      ch.nack(msg, false, false);
    }
  });

  console.log("🎧 Interactions consumers activos (likes & comments)");
}

module.exports = { startConsumers };
