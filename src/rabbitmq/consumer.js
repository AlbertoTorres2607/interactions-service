const amqp = require('amqplib');
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const PostInteraction = require('../models/PostInteraction');

class RabbitMQConsumer {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
  }

  async connect() {
    try {
      this.connection = await amqp.connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      
      // Declare queues
      await this.channel.assertQueue('comments.create', { durable: true });
      await this.channel.assertQueue('likes.create', { durable: true });
      await this.channel.assertQueue('likes.delete', { durable: true });
      
      console.log('[RabbitMQ] Connected and queues declared');
    } catch (error) {
      console.error('[RabbitMQ] Connection failed:', error);
      throw error;
    }
  }

  async startConsuming() {
    // Consume comment creation messages
    await this.channel.consume('comments.create', async (msg) => {
      if (msg !== null) {
        try {
          const commentData = JSON.parse(msg.content.toString());
          await this.handleCommentCreation(commentData);
          this.channel.ack(msg);
        } catch (error) {
          console.error('[RabbitMQ] Error processing comment creation:', error);
          this.channel.nack(msg, false, false); // Don't requeue on error
        }
      }
    });

    // Consume like creation messages
    await this.channel.consume('likes.create', async (msg) => {
      if (msg !== null) {
        try {
          const likeData = JSON.parse(msg.content.toString());
          await this.handleLikeCreation(likeData);
          this.channel.ack(msg);
        } catch (error) {
          console.error('[RabbitMQ] Error processing like creation:', error);
          this.channel.nack(msg, false, false);
        }
      }
    });

    // Consume like deletion messages
    await this.channel.consume('likes.delete', async (msg) => {
      if (msg !== null) {
        try {
          const likeData = JSON.parse(msg.content.toString());
          await this.handleLikeDeletion(likeData);
          this.channel.ack(msg);
        } catch (error) {
          console.error('[RabbitMQ] Error processing like deletion:', error);
          this.channel.nack(msg, false, false);
        }
      }
    });

    console.log('[RabbitMQ] Started consuming messages');
  }

  async handleCommentCreation(commentData) {
    const { postId, authorId, text, parentCommentId } = commentData;
    
    // Create the comment
    const comment = await Comment.create({
      postId,
      authorId,
      text,
      parentCommentId: parentCommentId || null
    });

    // Update post interactions count
    await PostInteraction.findOneAndUpdate(
      { postId },
      { 
        $inc: { commentsCount: 1 },
        $set: { lastActivityAt: new Date() }
      },
      { upsert: true, new: true }
    );

    console.log(`[RabbitMQ] Created comment for post ${postId}`);
  }

  async handleLikeCreation(likeData) {
    const { targetType, targetId, userId } = likeData;
    
    try {
      // Create the like
      await Like.create({
        targetType,
        targetId,
        userId
      });

      // Update counts based on target type
      if (targetType === 'post') {
        await PostInteraction.findOneAndUpdate(
          { postId: targetId },
          { 
            $inc: { likesCount: 1 },
            $set: { lastActivityAt: new Date() }
          },
          { upsert: true, new: true }
        );
      } else if (targetType === 'comment') {
        await Comment.findByIdAndUpdate(
          targetId,
          { $inc: { likesCount: 1 } }
        );
      }

      console.log(`[RabbitMQ] Created like for ${targetType} ${targetId}`);
    } catch (error) {
      if (error.code === 11000) {
        console.log(`[RabbitMQ] Like already exists for ${targetType} ${targetId}`);
      } else {
        throw error;
      }
    }
  }

  async handleLikeDeletion(likeData) {
    const { targetType, targetId, userId } = likeData;
    
    // Delete the like
    const result = await Like.deleteOne({
      targetType,
      targetId,
      userId
    });

    if (result.deletedCount > 0) {
      // Update counts based on target type
      if (targetType === 'post') {
        await PostInteraction.findOneAndUpdate(
          { postId: targetId },
          { 
            $inc: { likesCount: -1 },
            $set: { lastActivityAt: new Date() }
          }
        );
      } else if (targetType === 'comment') {
        await Comment.findByIdAndUpdate(
          targetId,
          { $inc: { likesCount: -1 } }
        );
      }

      console.log(`[RabbitMQ] Deleted like for ${targetType} ${targetId}`);
    }
  }

  async close() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}

module.exports = RabbitMQConsumer;