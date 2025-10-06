import Conversation, { IConversationDocument } from '../models/Conversation';
import { sessionService } from './sessionService';
import { openaiService } from './openaiService';
import { IMessage, IConversationContext } from '../types';
import logger from '../utils/logger';
import { AuthUtils } from '../utils/auth';
import { config } from '../config';

/**
 * Conversation service for managing chat conversations
 */
export class ConversationService {
  private static instance: ConversationService;

  /**
   * Get singleton instance
   */
  static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  /**
   * Initialize the conversation service
   */
  async initialize(): Promise<void> {
    try {
      // Archive old conversations on startup
      await this.archiveOldConversations(30);
      
      logger.info('Conversation service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize conversation service', { error });
      throw error;
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    sessionId: string,
    title?: string,
    context?: Partial<IConversationContext>
  ): Promise<IConversationDocument> {
    try {
      // Verify session exists
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const conversationId = AuthUtils.generateUniqueId();
      
      const conversationData = {
        conversationId,
        sessionId,
        title: title || 'New Conversation',
        messages: [],
        context: {
          currentTopic: context?.currentTopic || 'general',
          extractedData: context?.extractedData || {},
          userIntent: context?.userIntent || 'unknown',
          conversationState: context?.conversationState || 'active',
          pendingActions: context?.pendingActions || [],
          flags: context?.flags || {},
        },
        summary: '',
        status: 'active',
      };

      const conversation = new Conversation(conversationData);

      await conversation.save();

      // Add conversation to session
      await sessionService.addConversation(sessionId, conversationId);

      logger.info('Conversation created', {
        conversationId,
        sessionId,
        title,
      });

      return conversation;
    } catch (error) {
      logger.error('Failed to create conversation', { error, sessionId });
      throw error;
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<IConversationDocument | null> {
    try {
      const conversation = await Conversation.findOne({ conversationId });
      
      if (conversation) {
        logger.debug('Conversation retrieved', { conversationId });
      }

      return conversation;
    } catch (error) {
      logger.error('Failed to get conversation', { error, conversationId });
      throw error;
    }
  }

  /**
   * Add message to conversation and generate AI response
   */
  async addMessage(
    conversationId: string,
    message: string,
    role: 'user' | 'assistant' | 'system' = 'user',
    generateResponse: boolean = true
  ): Promise<{
    conversation: IConversationDocument;
    aiResponse?: IMessage;
  }> {
    try {
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Add user message
      const userMessage: IMessage = {
        messageId: AuthUtils.generateUniqueId(),
        role,
        content: message,
        timestamp: new Date(),
        metadata: {},
      };

      conversation.addMessage(userMessage.messageId, userMessage.role, userMessage.content, userMessage.metadata);

      let aiResponse: IMessage | null | undefined;

      // Generate AI response if requested and message is from user
      if (generateResponse && role === 'user') {
        aiResponse = await this.generateAIResponse(conversation);
        
        if (aiResponse) {
          conversation.addMessage(aiResponse.messageId, aiResponse.role, aiResponse.content, aiResponse.metadata);
        }
      }

      // Update conversation context based on the new message
      await this.updateConversationContext(conversation, message, role);

      await conversation.save();

      logger.info('Message added to conversation', {
        conversationId,
        role,
        messageLength: message.length,
        hasAIResponse: !!aiResponse,
      });

      return {
        conversation,
        aiResponse: aiResponse || undefined,
      };
    } catch (error) {
      logger.error('Failed to add message to conversation', {
        error,
        conversationId,
        role,
      });
      throw error;
    }
  }

  /**
   * Generate AI response for conversation
   */
  async generateAIResponse(conversation: IConversationDocument): Promise<IMessage | null> {
    try {
      // Analyze user intent
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      const intent = await openaiService.analyzeTaxIntent(
        lastMessage.content,
        conversation.context
      );

      // Update context with analyzed intent
      conversation.context.userIntent = intent.intent;
      conversation.context.extractedData = {
        ...conversation.context.extractedData,
        ...intent.entities.reduce((acc, entity) => {
          acc[entity.type] = entity.value;
          return acc;
        }, {} as any),
      };

      // Generate response using OpenAI
      const completion = await openaiService.generateChatCompletion(
        conversation.messages,
        conversation.context,
        {
          temperature: config.openai.temperature,
          maxTokens: config.openai.maxTokens,
        }
      );

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        logger.warn('No response content from OpenAI', { conversationId: conversation.conversationId });
        return null;
      }

      const aiMessage: IMessage = {
        messageId: AuthUtils.generateUniqueId(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        metadata: {
          model: completion.model,
          usage: completion.usage,
          finishReason: completion.choices[0]?.finish_reason,
          intent: intent.intent,
          confidence: intent.confidence,
        },
      };

      logger.debug('AI response generated', {
        conversationId: conversation.conversationId,
        responseLength: responseContent.length,
        intent: intent.intent,
        confidence: intent.confidence,
      });

      return aiMessage;
    } catch (error) {
      logger.error('Failed to generate AI response', {
        error,
        conversationId: conversation.conversationId,
      });
      
      // Return fallback response
      return {
        messageId: AuthUtils.generateUniqueId(),
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble processing your request right now. Please try again or rephrase your question.',
        timestamp: new Date(),
        metadata: {
          error: true,
          fallback: true,
        },
      };
    }
  }

  /**
   * Generate streaming AI response
   */
  async generateStreamingResponse(
    conversationId: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const stream = await openaiService.generateStreamingCompletion(
        conversation.messages,
        conversation.context
      );

      let fullResponse = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }

      // Add the complete AI response to conversation
      conversation.addMessage(
        AuthUtils.generateUniqueId(),
        'assistant',
        fullResponse,
        {
          streaming: true,
        }
      );
      await conversation.save();

      onComplete(fullResponse);

      logger.info('Streaming response completed', {
        conversationId,
        responseLength: fullResponse.length,
      });
    } catch (error) {
      logger.error('Failed to generate streaming response', { error, conversationId });
      onError(error as Error);
    }
  }

  /**
   * Update conversation context based on message
   */
  private async updateConversationContext(
    conversation: IConversationDocument,
    message: string,
    role: string
  ): Promise<void> {
    try {
      // Extract tax-related information from the message
      if (role === 'user') {
        const intent = await openaiService.analyzeTaxIntent(message, conversation.context);
        
        // Update context
        conversation.context.userIntent = intent.intent;
        conversation.context.currentTopic = this.determineTopic(message, intent);
        
        // Merge extracted data
        conversation.context.extractedData = {
          ...conversation.context.extractedData,
          ...intent.entities.reduce((acc, entity) => {
            acc[entity.type] = entity.value;
            return acc;
          }, {} as any),
        };

        // Update pending actions based on intent
        if (intent.suggestions && Array.isArray(intent.suggestions)) {
          conversation.context.pendingActions = intent.suggestions.map((suggestion: string) => ({
            action: suggestion,
            parameters: {},
            priority: 1,
          }));
        }
      }

      // Update conversation state
      if (conversation.messages.length > 10) {
        conversation.context.conversationState = 'review';
      } else if (conversation.messages.length > 5) {
        conversation.context.conversationState = 'data_collection';
      } else {
        conversation.context.conversationState = 'greeting';
      }

      logger.debug('Conversation context updated', {
        conversationId: conversation.conversationId,
        intent: conversation.context.userIntent,
        topic: conversation.context.currentTopic,
        state: conversation.context.conversationState,
      });
    } catch (error) {
      logger.error('Failed to update conversation context', {
        error,
        conversationId: conversation.conversationId,
      });
    }
  }

  /**
   * Determine conversation topic from message and intent
   */
  private determineTopic(message: string, intent: any): string {
    const topicKeywords = {
      'form_1040': ['1040', 'individual', 'personal tax'],
      'deductions': ['deduction', 'itemize', 'standard deduction'],
      'income': ['income', 'salary', 'wages', 'w2', '1099'],
      'business': ['business', 'schedule c', 'self employed'],
      'investment': ['investment', 'capital gains', 'dividend', 'stock'],
      'retirement': ['retirement', '401k', 'ira', 'pension'],
      'family': ['dependent', 'child', 'married', 'filing status'],
      'refund': ['refund', 'owe', 'payment', 'balance due'],
    };

    const lowerMessage = message.toLowerCase();
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return topic;
      }
    }

    return intent.intent || 'general';
  }

  /**
   * Get conversations by session
   */
  async getConversationsBySession(
    sessionId: string,
    options: {
      status?: string;
      limit?: number;
      skip?: number;
      sort?: any;
    } = {}
  ): Promise<IConversationDocument[]> {
    try {
      const query: any = { sessionId };
      
      if (options.status) {
        query.status = options.status;
      }

      const conversations = await Conversation.find(query)
        .sort(options.sort || { createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);

      logger.debug('Conversations retrieved by session', {
        sessionId,
        count: conversations.length,
        options,
      });

      return conversations;
    } catch (error) {
      logger.error('Failed to get conversations by session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Update conversation status
   */
  async updateConversationStatus(
    conversationId: string,
    status: 'active' | 'paused' | 'completed' | 'archived'
  ): Promise<boolean> {
    try {
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        return false;
      }

      await conversation.updateStatus(status);

      logger.info('Conversation status updated', { conversationId, status });

      return true;
    } catch (error) {
      logger.error('Failed to update conversation status', {
        error,
        conversationId,
        status,
      });
      throw error;
    }
  }

  /**
   * Update conversation
   */
  async updateConversation(
    conversationId: string,
    updateData: {
      title?: string;
      status?: 'active' | 'paused' | 'completed' | 'archived';
      metadata?: any;
    }
  ): Promise<IConversationDocument> {
    try {
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Update fields
      if (updateData.title !== undefined) {
        conversation.title = updateData.title;
      }
      if (updateData.status !== undefined) {
        conversation.status = updateData.status;
      }
      if (updateData.metadata !== undefined) {
        conversation.context.extractedData = {
          ...conversation.context.extractedData,
          ...updateData.metadata,
        };
      }

      conversation.updatedAt = new Date();
      await conversation.save();

      logger.info('Conversation updated', {
        conversationId,
        updateData,
      });

      return conversation;
    } catch (error) {
      logger.error('Failed to update conversation', {
        error,
        conversationId,
        updateData,
      });
      throw error;
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Remove conversation from session
      await sessionService.removeConversation(conversation.sessionId, conversationId);

      // Delete the conversation
      await Conversation.deleteOne({ conversationId });

      logger.info('Conversation deleted', { conversationId });

      return true;
    } catch (error) {
      logger.error('Failed to delete conversation', {
        error,
        conversationId,
      });
      throw error;
    }
  }

  /**
   * Generate conversation summary
   */
  async generateSummary(conversationId: string): Promise<string | null> {
    try {
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation || conversation.messages.length === 0) {
        return null;
      }

      const messages = conversation.messages.map(msg => 
        `${msg.role}: ${msg.content}`
      ).join('\n');

      const systemPrompt = `Summarize this tax-related conversation in 2-3 sentences. Focus on the main topics discussed and any important decisions or information gathered.`;

      const completion = await openaiService.generateChatCompletion([
        { messageId: '', role: 'system', content: systemPrompt, timestamp: new Date(), metadata: {} },
        { messageId: '', role: 'user', content: messages, timestamp: new Date(), metadata: {} },
      ]);

      const summary = completion.choices[0]?.message?.content || '';

      // Update conversation with summary
      await conversation.updateSummary(summary);

      logger.info('Conversation summary generated', {
        conversationId,
        summaryLength: summary.length,
      });

      return summary;
    } catch (error) {
      logger.error('Failed to generate conversation summary', {
        error,
        conversationId,
      });
      return null;
    }
  }

  /**
   * Archive old conversations
   */
  async archiveOldConversations(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await Conversation.updateMany(
        {
          lastMessageAt: { $lt: cutoffDate },
          status: { $ne: 'archived' },
        },
        {
          $set: { status: 'archived' },
        }
      );

      logger.info('Old conversations archived', {
        count: result.modifiedCount,
        olderThanDays,
      });

      return result.modifiedCount;
    } catch (error) {
      logger.error('Failed to archive old conversations', { error, olderThanDays });
      throw error;
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(): Promise<{
    total: number;
    active: number;
    archived: number;
    byStatus: Record<string, number>;
    averageMessages: number;
    totalMessages: number;
  }> {
    try {
      const [
        total,
        active,
        archived,
        statusStats,
        messageStats,
        totalMessagesStats,
      ] = await Promise.all([
        Conversation.countDocuments(),
        Conversation.countDocuments({ status: 'active' }),
        Conversation.countDocuments({ status: 'archived' }),
        Conversation.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Conversation.aggregate([
          {
            $group: {
              _id: null,
              averageMessages: { $avg: { $size: '$messages' } },
            },
          },
        ]),
        Conversation.aggregate([
          {
            $group: {
              _id: null,
              totalMessages: { $sum: { $size: '$messages' } },
            },
          },
        ]),
      ]);

      const byStatus: Record<string, number> = {};
      statusStats.forEach((stat: any) => {
        byStatus[stat._id] = stat.count;
      });

      const averageMessages = messageStats[0]?.averageMessages || 0;
      const totalMessages = totalMessagesStats[0]?.totalMessages || 0;

      return {
        total,
        active,
        archived,
        byStatus,
        averageMessages,
        totalMessages,
      };
    } catch (error) {
      logger.error('Failed to get conversation statistics', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const conversationService = ConversationService.getInstance();