const express = require("express");
const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const { getUserId } = require("../auth");

const r = express.Router();

// Crear comentario
r.post("/comments", async (req, res) => {
  const { postId, text, parentCommentId = null } = req.body || {};
  const userId = getUserId(req);

  if (!postId || !text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "postId y text son obligatorios" });
  }
  if (parentCommentId && !mongoose.isValidObjectId(parentCommentId)) {
    return res.status(400).json({ error: "parentCommentId inválido" });
  }

  const doc = await Comment.create({
    postId,
    authorId: userId,
    text: text.trim(),
    parentCommentId: parentCommentId || null
  });

  return res.status(201).json({ id: String(doc._id) });
});

// Editar comentario (sólo autor)
r.put("/comments/:id", async (req, res) => {
  const { id } = req.params;
  const { text } = req.body || {};
  const userId = getUserId(req);

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "id inválido" });
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "text es obligatorio" });
  }

  const c = await Comment.findById(id);
  if (!c || c.isDeleted) return res.status(404).json({ error: "Comentario no encontrado" });
  if (c.authorId !== userId) return res.status(403).json({ error: "Prohibido" });

  c.text = text.trim();
  await c.save();
  return res.json({ ok: true });
});

// Eliminar comentario (soft-delete, sólo autor)
r.delete("/comments/:id", async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "id inválido" });

  const c = await Comment.findById(id);
  if (!c || c.isDeleted) return res.status(404).json({ error: "Comentario no encontrado" });
  if (c.authorId !== userId) return res.status(403).json({ error: "Prohibido" });

  c.isDeleted = true;
  await c.save();
  return res.status(204).send();
});

// Dar like (idempotente)
r.post("/comments/:id/like", async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "id inválido" });

  const comment = await Comment.findById(id);
  if (!comment || comment.isDeleted) return res.status(404).json({ error: "Comentario no encontrado" });

  try {
    await Like.create({ commentId: comment._id, userId });
    await Comment.updateOne({ _id: comment._id }, { $inc: { likesCount: 1 } });
    return res.json({ liked: true });
  } catch (e) {
    if (e && e.code === 11000) {
      return res.json({ liked: true, dedup: true }); // ya estaba likeado
    }
    throw e;
  }
});

// Quitar like (idempotente)
r.delete("/comments/:id/like", async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "id inválido" });

  const comment = await Comment.findById(id);
  if (!comment || comment.isDeleted) return res.status(404).json({ error: "Comentario no encontrado" });

  const result = await Like.deleteOne({ commentId: comment._id, userId });
  if (result.deletedCount > 0) {
    await Comment.updateOne({ _id: comment._id }, { $inc: { likesCount: -1 } });
  }
  return res.json({ liked: false });
});

module.exports = r;
