// src/models/PostLike.js
const mongoose = require("mongoose");

const PostLikeSchema = new mongoose.Schema({
  postId: { type: String, index: true, required: true },
  userId: { type: String, index: true, required: true }
}, { timestamps: true });

PostLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("PostLike", PostLikeSchema, "post_likes");
