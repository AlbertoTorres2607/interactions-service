// src/models/Comment.js (agrega campos si no existen)
const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  postId: String,
  authorId: String,
  text: { type: String, maxlength: 2000 },
  parentCommentId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  likesCount: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  eventId: { type: String, default: null } // <-- NUEVO (para dedupe)
}, { timestamps: true });

CommentSchema.index({ postId: 1, _id: -1 });
CommentSchema.index({ parentCommentId: 1, _id: 1 });
CommentSchema.index({ postId: 1, isDeleted: 1 });
CommentSchema.index({ eventId: 1 }, { unique: true, sparse: true }); // <-- NUEVO

module.exports = mongoose.model("Comment", CommentSchema);
