import { Request, Response } from 'express';
import { conversationService } from '../services/conversationService';
import { sessionService } from '../services/sessionService';
import logger from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { CustomApiError } from '../middleware/errorHandler';

/**
 * Conversation controller handling all conversation-related operations
 */
export class ConversationController {
  /**
   * Create a new conversation
   * POST /api/conversations
   */
  static createConversation = asyncHandler(async (req: Request, res: Response) => {
    const { title, metadata } = req.body;
    const sessionId = req.headers['x-session-id'] as string;

    logger.info('Creating new conversation', { sessionId, title });

    // Verify session exists and user has access
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new CustomApiError('Session not found', 400, 'SESSION_NOT_FOUND');
    }

    const conversation = await conversationService.createConversation(
      sessionId,
      title || 'New Conversation',
      { extractedData: metadata }
    );

    res.status(201).json({
      conversationId: conversation.conversationId,
      sessionId: conversation.sessionId,
      title: conversation.title,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  });

  /**
   * Get conversations for session
   * GET /api/conversations
   */
  static getConversations = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.headers['x-session-id'] as string;
    const {
      status,
      page = 1,
      limit = 20,
      sort = 'createdAt',
      order = 'desc',
    } = req.query;

    logger.debug('Retrieving conversations for session', { sessionId });

    // Verify session exists
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new CustomApiError('Session not found', 400, 'SESSION_NOT_FOUND');
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj: any = {};
    sortObj[sort as string] = order === 'desc' ? -1 : 1;

    const conversations = await conversationService.getConversationsBySession(sessionId, {
      status: status as string,
      limit: Number(limit),
      skip,
      sort: sortObj,
    });

    const conversationData = conversations.map(conv => ({
      conversationId: conv.conversationId,
      sessionId: conv.sessionId,
      title: conv.title,
      status: conv.status,
      messageCount: conv.messages.length,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lastMessageAt: conv.lastMessageAt,
    }));

    res.json({
      conversations: conversationData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: conversationData.length,
        hasMore: conversationData.length === Number(limit),
      },
    });
  });

  /**
   * Get conversation by ID
   * GET /api/conversations/:conversationId
   */
  static getConversation = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { includeMessages = 'true' } = req.query;
    const sessionId = req.headers['x-session-id'] as string;

    logger.debug('Retrieving conversation', { conversationId, sessionId });

    // Verify session exists
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new CustomApiError('Session not found', 400, 'SESSION_NOT_FOUND');
    }

    const conversation = await conversationService.getConversation(conversationId);

    if (!conversation) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    // Verify the conversation belongs to the session
    if (conversation.sessionId !== sessionId) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    const responseData: any = {
      conversationId: conversation.conversationId,
      sessionId: conversation.sessionId,
      title: conversation.title,
      status: conversation.status,
      context: conversation.context,
      summary: conversation.summary,
      messageCount: conversation.messages.length,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
    };

    if (includeMessages === 'true') {
      responseData.messages = conversation.messages.map(msg => ({
        messageId: msg.messageId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        metadata: msg.metadata,
      }));
    }

    res.json(responseData);
  });

  /**
   * Update conversation
   * PUT /api/conversations/:conversationId
   */
  static updateConversation = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { title, status, metadata } = req.body;
    const sessionId = req.headers['x-session-id'] as string;

    logger.info('Updating conversation', { conversationId, title, status, sessionId });

    // Verify session exists
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new CustomApiError('Session not found', 400, 'SESSION_NOT_FOUND');
    }

    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    // Verify the conversation belongs to the session
    if (conversation.sessionId !== sessionId) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (status !== undefined) updateData.status = status;
    if (metadata !== undefined) updateData.metadata = metadata;

    const updated = await conversationService.updateConversation(conversationId, updateData);

    res.json({
      conversationId: updated.conversationId,
      sessionId: updated.sessionId,
      title: updated.title,
      status: updated.status,
      updatedAt: updated.updatedAt,
    });
  });

  /**
   * Delete conversation
   * DELETE /api/conversations/:conversationId
   */
  static deleteConversation = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const sessionId = req.headers['x-session-id'] as string;

    logger.info('Deleting conversation', { conversationId, sessionId });

    // Verify session exists
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new CustomApiError('Session not found', 400, 'SESSION_NOT_FOUND');
    }

    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    // Verify the conversation belongs to the session
    if (conversation.sessionId !== sessionId) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    await conversationService.deleteConversation(conversationId);

    res.json({
      message: 'Conversation archived successfully',
      conversationId,
    });
  });

  /**
   * Add message with streaming response
   * POST /api/conversations/:conversationId/messages/stream
   */
  static addMessageWithStreaming = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { message, role = 'user' } = req.body;
    const sessionId = req.headers['x-session-id'] as string;

    logger.info('Adding message with streaming response', {
      conversationId,
      role,
      messageLength: message.length,
      sessionId,
    });

    // Verify session exists
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new CustomApiError('Session not found', 400, 'SESSION_NOT_FOUND');
    }

    // Verify conversation exists and belongs to session
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    if (conversation.sessionId !== sessionId) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    try {
      // Add user message first
      const result = await conversationService.addMessage(
        conversationId,
        message,
        role,
        false // Don't generate response yet
      );

      // Send user message confirmation
      res.write(`data: ${JSON.stringify({
        type: 'user_message',
        data: {
          messageId: result.conversation.messages[result.conversation.messages.length - 1].messageId,
          content: message,
          timestamp: new Date(),
        },
      })}\n\n`);

      // Generate streaming AI response
      await conversationService.generateStreamingResponse(
        conversationId,
        (chunk: string) => {
          // Send chunk to client
          res.write(`data: ${JSON.stringify({
            type: 'chunk',
            data: { content: chunk },
          })}\n\n`);
        },
        (fullResponse: string) => {
          // Send completion
          res.write(`data: ${JSON.stringify({
            type: 'complete',
            data: {
              content: fullResponse,
              timestamp: new Date(),
            },
          })}\n\n`);
          
          res.end();
        },
        (error: Error) => {
          // Send error
          res.write(`data: ${JSON.stringify({
            type: 'error',
            data: {
              message: error.message,
              timestamp: new Date(),
            },
          })}\n\n`);
          
          res.end();
        }
      );

      // Handle client disconnect
      req.on('close', () => {
        logger.debug('Client disconnected from stream', { conversationId });
      });
    } catch (error) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        data: {
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        },
      })}\n\n`);
      
      res.end();
    }
  });

  /**
   * Add message to conversation (simple format)
   * POST /api/conversations/:conversationId/messages
   */
  static addMessage = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { content, role = 'user', generateResponse = true } = req.body;
    const sessionId = req.headers['x-session-id'] as string;

    logger.info('Adding message to conversation', {
      conversationId,
      role,
      messageLength: content.length,
      sessionId,
    });

    // Verify session exists
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new CustomApiError('Session not found', 400, 'SESSION_NOT_FOUND');
    }

    // Verify conversation exists and belongs to session
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    if (conversation.sessionId !== sessionId) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    const result = await conversationService.addMessage(
      conversationId,
      content,
      role,
      generateResponse
    );

    // Get the user message that was just added
    const userMessage = result.conversation.messages[result.conversation.messages.length - (result.aiResponse ? 2 : 1)];

    const responseData: any = {
      messageId: userMessage.messageId,
      content: userMessage.content,
      role: userMessage.role,
      timestamp: userMessage.timestamp,
    };

    // Include AI response if generated
    if (result.aiResponse) {
      responseData.aiResponse = {
        messageId: result.aiResponse.messageId,
        role: result.aiResponse.role,
        content: result.aiResponse.content,
        timestamp: result.aiResponse.timestamp,
      };
    }

    res.status(201).json(responseData);
  });

  /**
   * Get conversation messages
   * GET /api/v1/conversations/:conversationId/messages
   */
  static getMessages = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const {
      page = 1,
      limit = 50,
      role,
      since,
      until,
    } = req.query;

    logger.debug('Retrieving conversation messages', { conversationId });

    const conversation = await conversationService.getConversation(conversationId);

    if (!conversation) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    let messages = conversation.messages;

    // Filter by role if specified
    if (role) {
      messages = messages.filter(msg => msg.role === role);
    }

    // Filter by date range if specified
    if (since) {
      const sinceDate = new Date(since as string);
      messages = messages.filter(msg => msg.timestamp >= sinceDate);
    }

    if (until) {
      const untilDate = new Date(until as string);
      messages = messages.filter(msg => msg.timestamp <= untilDate);
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    const paginatedMessages = messages.slice(skip, skip + Number(limit));

    const messageData = paginatedMessages.map(msg => ({
      messageId: msg.messageId,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      metadata: msg.metadata,
    }));

    res.json({
      success: true,
      data: messageData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: messages.length,
        hasMore: skip + Number(limit) < messages.length,
      },
    });
  });

  /**
   * Update conversation status
   * PUT /api/v1/conversations/:conversationId/status
   */
  static updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { status } = req.body;

    logger.info('Updating conversation status', { conversationId, status });

    const updated = await conversationService.updateConversationStatus(conversationId, status);

    if (!updated) {
      throw new CustomApiError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        conversationId,
        status,
        updatedAt: new Date(),
      },
      message: 'Conversation status updated successfully',
    });
  });

  /**
   * Generate conversation summary
   * POST /api/v1/conversations/:conversationId/summary
   */
  static generateSummary = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;

    logger.info('Generating conversation summary', { conversationId });

    const summary = await conversationService.generateSummary(conversationId);

    if (!summary) {
      throw new CustomApiError('Unable to generate summary', 400, 'SUMMARY_GENERATION_FAILED');
    }

    res.json({
      success: true,
      data: {
        conversationId,
        summary,
        generatedAt: new Date(),
      },
      message: 'Summary generated successfully',
    });
  });

  /**
   * Get conversations by session
   * GET /api/v1/sessions/:sessionId/conversations
   */
  static getConversationsBySession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const {
      status,
      page = 1,
      limit = 20,
      sort = 'createdAt',
      order = 'desc',
    } = req.query;

    logger.debug('Retrieving conversations for session', { sessionId });

    // Verify session exists
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new CustomApiError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj: any = {};
    sortObj[sort as string] = order === 'desc' ? -1 : 1;

    const conversations = await conversationService.getConversationsBySession(sessionId, {
      status: status as string,
      limit: Number(limit),
      skip,
      sort: sortObj,
    });

    const conversationData = conversations.map(conv => ({
      conversationId: conv.conversationId,
      status: conv.status,
      context: conv.context,
      summary: conv.summary,
      messageCount: conv.messages.length,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lastMessageAt: conv.lastMessageAt,
    }));

    res.json({
      success: true,
      data: conversationData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: conversationData.length,
        hasMore: conversationData.length === Number(limit),
      },
    });
  });

  /**
   * Stream chat response
   * POST /api/v1/conversations/:conversationId/stream
   */
  static streamResponse = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { message } = req.body;

    logger.info('Starting streaming response', { conversationId });

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Add user message first
    const result = await conversationService.addMessage(
      conversationId,
      message,
      'user',
      false // Don't generate response yet
    );

    // Send user message confirmation
    res.write(`data: ${JSON.stringify({
      type: 'user_message',
      data: {
        messageId: result.conversation.messages[result.conversation.messages.length - 1].messageId,
        content: message,
        timestamp: new Date(),
      },
    })}\n\n`);

    // Generate streaming AI response
    await conversationService.generateStreamingResponse(
      conversationId,
      (chunk: string) => {
        // Send chunk to client
        res.write(`data: ${JSON.stringify({
          type: 'chunk',
          data: { content: chunk },
        })}\n\n`);
      },
      (fullResponse: string) => {
        // Send completion
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          data: {
            content: fullResponse,
            timestamp: new Date(),
          },
        })}\n\n`);
        
        res.end();
      },
      (error: Error) => {
        // Send error
        res.write(`data: ${JSON.stringify({
          type: 'error',
          data: {
            message: error.message,
            timestamp: new Date(),
          },
        })}\n\n`);
        
        res.end();
      }
    );

    // Handle client disconnect
    req.on('close', () => {
      logger.debug('Client disconnected from stream', { conversationId });
    });
  });

  /**
   * Get conversation statistics
   * GET /api/v1/conversations/stats
   */
  static getConversationStats = asyncHandler(async (req: Request, res: Response) => {
    logger.debug('Retrieving conversation statistics');

    const stats = await conversationService.getConversationStats();

    res.json({
      success: true,
      data: stats,
    });
  });

  /**
   * Archive old conversations
   * POST /api/v1/conversations/archive
   */
  static archiveOldConversations = asyncHandler(async (req: Request, res: Response) => {
    const { olderThanDays = 30 } = req.body;

    logger.info('Archiving old conversations', { olderThanDays });

    const archivedCount = await conversationService.archiveOldConversations(olderThanDays);

    res.json({
      success: true,
      data: {
        archivedCount,
        olderThanDays,
      },
      message: `Archived ${archivedCount} old conversations`,
    });
  });

  /**
   * Health check for conversation service
   * GET /api/v1/conversations/health
   */
  static healthCheck = asyncHandler(async (req: Request, res: Response) => {
    const stats = await conversationService.getConversationStats();

    res.json({
      success: true,
      data: {
        service: 'conversation',
        status: 'healthy',
        statistics: stats,
        timestamp: new Date().toISOString(),
      },
    });
  });
}

export default ConversationController;