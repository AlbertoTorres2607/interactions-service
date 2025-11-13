const Comment = require("../models/Comment");
const Like = require("../models/Like");
const mongoose = require("mongoose");

function toEdge(doc) {
  return { cursor: String(doc._id), node: toComment(doc) };
}

function toComment(doc) {
  return {
    id: String(doc._id),
    postId: doc.postId,
    authorId: doc.authorId,
    text: doc.text,
    parentCommentId: doc.parentCommentId ? String(doc.parentCommentId) : null,
    likesCount: doc.likesCount ?? 0,
    isDeleted: !!doc.isDeleted,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

const resolvers = {
  async commentsByPost({ postId, after, limit = 20 }) {
    const lim = Math.max(1, Math.min(limit, 100));
    const q = { postId, isDeleted: false };
    if (after) {
      if (!mongoose.isValidObjectId(after)) throw new Error("Invalid 'after' cursor");
      q._id = { $lt: new mongoose.Types.ObjectId(after) };
    }
    const docs = await Comment.find(q).sort({ _id: -1 }).limit(lim + 1);
    const hasNextPage = docs.length > lim;
    const slice = hasNextPage ? docs.slice(0, lim) : docs;
    const endCursor = slice.length ? String(slice[slice.length - 1]._id) : null;
    return {
      edges: slice.map(toEdge),
      pageInfo: { endCursor, hasNextPage }
    };
  },

  async comment({ id }) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await Comment.findById(id);
    return doc ? toComment(doc) : null;
  },

  async commentsCount({ postId }) {
    return await Comment.countDocuments({ postId, isDeleted: false });
  },

  async likesByComment({ commentId }) {
    if (!mongoose.isValidObjectId(commentId)) return [];
    const likes = await Like.find({ commentId }).sort({ _id: -1 }).limit(200);
    return likes.map(l => ({
      id: String(l._id),
      commentId: String(l.commentId),
      userId: l.userId,
      createdAt: l.createdAt.toISOString()
    }));
  }
};

module.exports = resolvers;
