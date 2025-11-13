const mongoose = require("mongoose");

const LikeSchema = new mongoose.Schema(
  {
    commentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "Comment" },
    userId: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

// Evita duplicados: 1 like por (commentId, userId)
LikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Like", LikeSchema);
