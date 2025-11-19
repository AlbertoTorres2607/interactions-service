const mongoose = require("mongoose");

const LikeSchema = new mongoose.Schema(
  {
    targetType: { type: String, required: true, enum: ['comment', 'post'] },
    targetId: { type: String, required: true, index: true }, 
    userId: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

// Evita duplicados: 1 like por (targetType, targetId, userId)
LikeSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Like", LikeSchema);