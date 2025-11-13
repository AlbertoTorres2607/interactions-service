const { buildSchema } = require("graphql");

const schema = buildSchema(`
  type Comment {
    id: ID!
    postId: String!
    authorId: String!
    text: String
    parentCommentId: ID
    likesCount: Int!
    isDeleted: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type Like {
    id: ID!
    commentId: ID!
    userId: String!
    createdAt: String!
  }

  type CommentEdge {
    cursor: String!
    node: Comment!
  }

  type PageInfo {
    endCursor: String
    hasNextPage: Boolean!
  }

  type CommentConnection {
    edges: [CommentEdge!]!
    pageInfo: PageInfo!
  }

  type Query {
    commentsByPost(postId: String!, after: String, limit: Int = 20): CommentConnection!
    comment(id: ID!): Comment
    commentsCount(postId: String!): Int!
    likesByComment(commentId: ID!): [Like!]!
  }
`);

module.exports = schema;
