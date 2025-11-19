const express = require("express");
const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const PostInteraction = require("../models/PostInteraction");
const { getUserId } = require("../auth");

const r = express.Router();

// Get post interactions (likes and comments count)
r.get("/interactions/posts/:postId", async (req, res) => {
  const { postId } = req.params;

  const interactions = await PostInteraction.findOne({ postId });
  
  return res.json({
    postId,
    likesCount: interactions?.likesCount || 0,
    commentsCount: interactions?.commentsCount || 0,
    lastActivityAt: interactions?.lastActivityAt || null
  });
});

// Get comments for a post
r.get("/interactions/posts/:postId/comments", async (req, res) => {
  const { postId } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  const comments = await Comment.find({ 
    postId, 
    isDeleted: false,
    parentCommentId: null // Only top-level comments
  })
  .sort({ createdAt: -1 })
  .limit(parseInt(limit))
  .skip(parseInt(offset));

  const total = await Comment.countDocuments({ 
    postId, 
    isDeleted: false,
    parentCommentId: null 
  });

  return res.json({
    comments: comments.map(c => ({
      id: String(c._id),
      postId: c.postId,
      authorId: c.authorId,
      text: c.text,
      likesCount: c.likesCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    })),
    total,
    hasMore: total > parseInt(offset) + comments.length
  });
});

// Like a post (synchronous - for immediate feedback)
r.post("/interactions/posts/:postId/like", async (req, res) => {
  const { postId } = req.params;
  const userId = getUserId();

  try {
    await Like.create({ 
      targetType: 'post', 
      targetId: postId, 
      userId 
    });

    // Update post interactions count
    await PostInteraction.findOneAndUpdate(
      { postId },
      { 
        $inc: { likesCount: 1 },
        $set: { lastActivityAt: new Date() }
      },
      { upsert: true, new: true }
    );

    return res.json({ liked: true });
  } catch (e) {
    if (e && e.code === 11000) {
      return res.json({ liked: true, dedup: true });
    }
    throw e;
  }
});

// Unlike a post (synchronous)
r.delete("/interactions/posts/:postId/like", async (req, res) => {
  const { postId } = req.params;
  const userId = getUserId();

  const result = await Like.deleteOne({ 
    targetType: 'post', 
    targetId: postId, 
    userId 
  });

  if (result.deletedCount > 0) {
    await PostInteraction.findOneAndUpdate(
      { postId },
      { 
        $inc: { likesCount: -1 },
        $set: { lastActivityAt: new Date() }
      }
    );
  }

  return res.json({ liked: false });
});

// Check if user liked a post
r.get("/interactions/posts/:postId/like", async (req, res) => {
  const { postId } = req.params;
  const userId = getUserId();

  const like = await Like.findOne({ 
    targetType: 'post', 
    targetId: postId, 
    userId 
  });

  return res.json({ liked: !!like });
});

// Get replies for a comment
r.get("/interactions/comments/:commentId/replies", async (req, res) => {
  const { commentId } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  if (!mongoose.isValidObjectId(commentId)) {
    return res.status(400).json({ error: "commentId inválido" });
  }

  const replies = await Comment.find({ 
    parentCommentId: commentId,
    isDeleted: false
  })
  .sort({ createdAt: 1 })
  .limit(parseInt(limit))
  .skip(parseInt(offset));

  const total = await Comment.countDocuments({ 
    parentCommentId: commentId,
    isDeleted: false 
  });

  return res.json({
    replies: replies.map(r => ({
      id: String(r._id),
      postId: r.postId,
      authorId: r.authorId,
      text: r.text,
      likesCount: r.likesCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    })),
    total,
    hasMore: total > parseInt(offset) + replies.length
  });
});

// Existing comment routes - update to use interactions prefix
r.post("/interactions/comments", async (req, res) => {
  const { postId, text, parentCommentId = null } = req.body || {};
  const userId = getUserId();

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
r.put("/interactions/comments/:id", async (req, res) => {
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
r.delete("/interactions/comments/:id", async (req, res) => {
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

// Dar like a comentario - simplified
r.post("/interactions/comments/:id/like", async (req, res) => {
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

// Quitar like de comentario - simplified
r.delete("/interactions/comments/:id/like", async (req, res) => {
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