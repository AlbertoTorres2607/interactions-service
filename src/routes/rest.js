const express = require("express");
const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const PostLike = require("../models/PostLike");

const r = express.Router();

// SIN seguridad: el user viene del body o query; si no, "demo-user"
const getUserId = (req) =>
  (req.body && (req.body.userId || req.body.authorId)) ||
  (req.query && req.query.userId) ||
  "demo-user";

// Crear comentario
r.post("/comments", async (req, res) => {
  const { postId, text, parentCommentId = null, authorId, userId } = req.body || {};
  const author = authorId || userId || getUserId(req);

  if (!postId || !text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "postId y text son obligatorios" });
  }
  if (!author) {
    return res.status(400).json({ error: "authorId (o userId) es obligatorio" });
  }
  if (parentCommentId && !mongoose.isValidObjectId(parentCommentId)) {
    return res.status(400).json({ error: "parentCommentId inválido" });
  }

  const doc = await Comment.create({
    postId,
    authorId: author,
    text: text.trim(),
    parentCommentId: parentCommentId || null
  });

  return res.status(201).json({ id: String(doc._id) });
});

// Editar comentario (sin check de autor)
r.put("/comments/:id", async (req, res) => {
  const { id } = req.params;
  const { text } = req.body || {};

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "id inválido" });
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "text es obligatorio" });
  }

  const c = await Comment.findById(id);
  if (!c || c.isDeleted) return res.status(404).json({ error: "Comentario no encontrado" });

  c.text = text.trim();
  await c.save();
  return res.json({ ok: true });
});

// Eliminar comentario (soft-delete, sin check de autor)
r.delete("/comments/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "id inválido" });

  const c = await Comment.findById(id);
  if (!c || c.isDeleted) return res.status(404).json({ error: "Comentario no encontrado" });

  c.isDeleted = true;
  await c.save();
  return res.status(204).send();
});

// Dar like (idempotente)
r.post("/comments/:id/like", async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "id inválido" });
  if (!userId) return res.status(400).json({ error: "userId es obligatorio" });

  const comment = await Comment.findById(id);
  if (!comment || comment.isDeleted) return res.status(404).json({ error: "Comentario no encontrado" });

  try {
    await Like.create({ commentId: comment._id, userId });
    await Comment.updateOne({ _id: comment._id }, { $inc: { likesCount: 1 } });
    return res.json({ liked: true });
  } catch (e) {
    if (e && e.code === 11000) {
      return res.json({ liked: true, dedup: true }); // ya existía
    }
    throw e;
  }
});

// Quitar like (idempotente)
r.delete("/comments/:id/like", async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "id inválido" });
  if (!userId) return res.status(400).json({ error: "userId es obligatorio" });

  const comment = await Comment.findById(id);
  if (!comment || comment.isDeleted) return res.status(404).json({ error: "Comentario no encontrado" });

  const result = await Like.deleteOne({ commentId: comment._id, userId });
  if (result.deletedCount > 0) {
    await Comment.updateOne({ _id: comment._id }, { $inc: { likesCount: -1 } });
  }
  return res.json({ liked: false });
});

r.get("/posts/:postId/counts", async (req, res) => {
  const { postId } = req.params;
  const [likeCount, commentCount] = await Promise.all([
    PostLike.countDocuments({ postId: String(postId) }),
    Comment.countDocuments({ postId: String(postId), isDeleted: false })
  ]);
  res.json({ postId, likeCount, commentCount });
});

module.exports = r;
