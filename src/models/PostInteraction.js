const mongoose = require("mongoose");

const PostInteractionSchema = new mongoose.Schema(
  {
    postId: { type: String, required: true, index: true },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Ensure one document per post
PostInteractionSchema.index({ postId: 1 }, { unique: true });

module.exports = mongoose.model("PostInteraction", PostInteractionSchema);