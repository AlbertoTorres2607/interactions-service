const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    postId: { type: String, required: true, index: true },
    authorId: { type: String, required: true, index: true },
    text: { type: String, required: true, maxlength: 2000 },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    likesCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

CommentSchema.index({ postId: 1, _id: -1 });

module.exports = mongoose.model("Comment", CommentSchema);