const express = require("express");
const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const { getUserId } = require("../auth");

const r = express.Router();

// Crear comentario - no auth needed
r.post("/comments", async (req, res) => {
  const { postId, text, parentCommentId = null } = req.body || {};
  const userId = getUserId(); // No req parameter needed

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

// Editar comentario - simplified
r.put("/comments/:id", async (req, res) => {
  const { id } = req.params;
  const { text } = req.body || {};
  const userId = getUserId();

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "id inválido" });
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "text es obligatorio" });
  }

  const c = await Comment.findById(id);
  if (!c || c.isDeleted) return res.status(404).json({ error: "Comentario no encontrado" });
  
  // Remove author check since Kong handles auth
  c.text = text.trim();
  await c.save();
  return res.json({ ok: true });
});

// Eliminar comentario - simplified
r.delete("/comments/:id", async (req, res) => {
  const { id } = req.params;
  const userId = getUserId();

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "id inválido" });

  const c = await Comment.findById(id);
  if (!c || c.isDeleted) return res.status(404).json({ error: "Comentario no encontrado" });
  
  // Remove author check
  c.isDeleted = true;
  await c.save();
  return res.status(204).send();
});

// Dar like - simplified
r.post("/comments/:id/like", async (req, res) => {
  const { id } = req.params;
  const userId = getUserId();

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "id inválido" });

  const comment = await Comment.findById(id);
  if (!comment || comment.isDeleted) return res.status(404).json({ error: "Comentario no encontrado" });

  try {
    await Like.create({ commentId: comment._id, userId });
    await Comment.updateOne({ _id: comment._id }, { $inc: { likesCount: 1 } });
    return res.json({ liked: true });
  } catch (e) {
    if (e && e.code === 11000) {
      return res.json({ liked: true, dedup: true });
    }
    throw e;
  }
});

// Quitar like - simplified
r.delete("/comments/:id/like", async (req, res) => {
  const { id } = req.params;
  const userId = getUserId();

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