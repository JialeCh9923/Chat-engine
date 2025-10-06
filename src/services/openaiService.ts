import OpenAI from 'openai';
import { config } from '../config';
import logger from '../utils/logger';
import { IMessage, IConversationContext } from '../types';

/**
 * OpenAI service for chat completions and AI interactions
 */
export class OpenAIService {
  private client?: OpenAI;
  private static instance: OpenAIService;
  private isTestEnvironment: boolean;

  constructor() {
    this.isTestEnvironment = process.env.NODE_ENV === 'test';
    
    // Only initialize OpenAI client if not in test environment and API key is available
    if (!this.isTestEnvironment && config.openai.apiKey) {
      this.client = new OpenAI({
        apiKey: config.openai.apiKey,
        timeout: config.openai.timeout,
        maxRetries: config.openai.maxRetries,
      });
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  /**
   * Initialize the OpenAI service
   */
  async initialize(): Promise<void> {
    try {
      if (this.isTestEnvironment) {
        logger.info('OpenAI service initialized in test mode (mocked responses)');
        return;
      }

      if (!config.openai.apiKey) {
        logger.warn('OpenAI API key not configured, service will use mock responses');
        return;
      }

      // Test the connection to OpenAI
      const isConnected = await this.testConnection();
      if (!isConnected) {
        logger.warn('OpenAI connection test failed, but service will continue');
      }

      logger.info('OpenAI service initialized successfully', {
        model: config.openai.model,
        connected: isConnected,
      });
    } catch (error) {
      logger.error('Failed to initialize OpenAI service', { error });
      throw error;
    }
  }

  /**
   * Generate chat completion
   */
  async generateChatCompletion(
    messages: IMessage[],
    context?: IConversationContext,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      functions?: any[];
      functionCall?: any;
    } = {}
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    try {
      // Return mock response in test environment or when API key is missing
      if (this.isTestEnvironment || !config.openai.apiKey) {
        return this.getMockChatCompletion(messages, options);
      }

      const {
        model = config.openai.model,
        temperature = config.openai.temperature,
        maxTokens = config.openai.maxTokens,
        stream = false,
        functions,
        functionCall,
      } = options;

      // Convert our message format to OpenAI format
      const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(context),
        },
        ...messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
      ];

      const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model,
        messages: openaiMessages,
        temperature,
        max_tokens: maxTokens,
        stream,
      };

      if (functions && functions.length > 0) {
        requestParams.functions = functions;
        if (functionCall) {
          requestParams.function_call = functionCall;
        }
      }

      logger.debug('Generating chat completion', {
        model,
        messageCount: messages.length,
        temperature,
        maxTokens,
        hasContext: !!context,
        hasFunctions: !!(functions && functions.length > 0),
      });

      const completion = await this.client!.chat.completions.create(requestParams) as OpenAI.Chat.Completions.ChatCompletion;

      logger.info('Chat completion generated', {
        model,
        usage: completion.usage,
        finishReason: completion.choices[0]?.finish_reason,
      });

      return completion;
    } catch (error) {
      logger.error('Failed to generate chat completion', { error, options });
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Generate streaming chat completion
   */
  async generateStreamingCompletion(
    messages: IMessage[],
    context?: IConversationContext,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      functions?: any[];
      functionCall?: any;
    } = {}
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    try {
      // Return mock streaming response in test environment or when API key is missing
      if (this.isTestEnvironment || !config.openai.apiKey) {
        return this.getMockStreamingCompletion(messages, options);
      }

      const {
        model = config.openai.model,
        temperature = config.openai.temperature,
        maxTokens = config.openai.maxTokens,
        functions,
        functionCall,
      } = options;

      // Convert our message format to OpenAI format
      const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(context),
        },
        ...messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
      ];

      const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model,
        messages: openaiMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      };

      if (functions && functions.length > 0) {
        requestParams.functions = functions;
        if (functionCall) {
          requestParams.function_call = functionCall;
        }
      }

      logger.debug('Generating streaming chat completion', {
        model,
        messageCount: messages.length,
        temperature,
        maxTokens,
        hasContext: !!context,
        hasFunctions: !!(functions && functions.length > 0),
      });

      const stream = await this.client!.chat.completions.create(requestParams);

      return stream;
    } catch (error) {
      logger.error('Failed to generate streaming completion', { error, options });
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbeddings(
    texts: string[],
    model: string = 'text-embedding-ada-002'
  ): Promise<number[][]> {
    try {
      logger.debug('Generating embeddings', { textCount: texts.length, model });

      const response = await this.client!.embeddings.create({
        model,
        input: texts,
      });

      const embeddings = response.data.map(item => item.embedding);

      logger.info('Embeddings generated', {
        model,
        textCount: texts.length,
        usage: response.usage,
      });

      return embeddings;
    } catch (error) {
      logger.error('Failed to generate embeddings', { error, texts: texts.length });
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Analyze text for tax-related entities and intent
   */
  async analyzeTaxIntent(
    text: string,
    context?: IConversationContext
  ): Promise<{
    intent: string;
    entities: any[];
    confidence: number;
    suggestions: string[];
  }> {
    try {
      // Return mock response in test environment or when API key is missing
      if (this.isTestEnvironment || !config.openai.apiKey) {
        return this.getMockTaxIntent(text);
      }

      const systemPrompt = `You are a tax filing assistant AI. Analyze the user's message and extract:
1. Intent (what they want to do)
2. Tax-related entities (forms, amounts, dates, etc.)
3. Confidence level (0-1)
4. Helpful suggestions

Respond in JSON format only.`;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ];

      const completion = await this.client!.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0.1,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const analysis = JSON.parse(response);

      logger.debug('Tax intent analyzed', { text: text.substring(0, 100), analysis });

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze tax intent', { error, text: text.substring(0, 100) });
      
      // Return default analysis on error
      return {
        intent: 'general_inquiry',
        entities: [],
        confidence: 0.5,
        suggestions: ['Please provide more specific information about your tax question.'],
      };
    }
  }

  /**
   * Generate tax form suggestions based on user input
   */
  async suggestTaxForms(
    userInfo: any,
    context?: IConversationContext
  ): Promise<{
    recommendedForms: string[];
    reasoning: string;
    additionalQuestions: string[];
  }> {
    try {
      // Return mock response in test environment or when API key is missing
      if (this.isTestEnvironment || !config.openai.apiKey) {
        return this.getMockTaxFormSuggestions(userInfo);
      }

      const systemPrompt = `You are a tax expert. Based on the user's information, suggest the most appropriate tax forms they need to file. Consider their income sources, filing status, deductions, and other relevant factors.

Respond in JSON format with:
- recommendedForms: array of form names
- reasoning: explanation for recommendations
- additionalQuestions: questions to gather more info if needed`;

      const userInfoText = JSON.stringify(userInfo, null, 2);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `User information: ${userInfoText}` },
      ];

      const completion = await this.client!.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.1,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const suggestions = JSON.parse(response);

      logger.debug('Tax forms suggested', { userInfo, suggestions });

      return suggestions;
    } catch (error) {
      logger.error('Failed to suggest tax forms', { error, userInfo });
      
      // Return default suggestions on error
      return {
        recommendedForms: ['1040'],
        reasoning: 'Form 1040 is the standard individual income tax return form.',
        additionalQuestions: [
          'What is your filing status?',
          'Do you have any dependents?',
          'What are your sources of income?',
        ],
      };
    }
  }

  /**
   * Validate tax calculations
   */
  async validateTaxCalculations(
    formData: any,
    calculations: any
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  }> {
    try {
      // Return mock response in test environment or when API key is missing
      if (this.isTestEnvironment || !config.openai.apiKey) {
        return this.getMockTaxValidation(formData, calculations);
      }

      const systemPrompt = `You are a tax calculation validator. Review the provided form data and calculations for accuracy. Check for:
1. Mathematical errors
2. Missing required fields
3. Inconsistencies
4. Potential optimization opportunities

Respond in JSON format with validation results.`;

      const dataText = JSON.stringify({ formData, calculations }, null, 2);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Tax data to validate: ${dataText}` },
      ];

      const completion = await this.client!.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.1,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const validation = JSON.parse(response);

      logger.debug('Tax calculations validated', { validation });

      return validation;
    } catch (error) {
      logger.error('Failed to validate tax calculations', { error });
      
      // Return default validation on error
      return {
        isValid: true,
        errors: [],
        warnings: ['Unable to validate calculations automatically'],
        suggestions: ['Please review calculations manually'],
      };
    }
  }

  /**
   * Build system prompt based on context
   */
  private buildSystemPrompt(context?: IConversationContext): string {
    let prompt = `You are a helpful tax filing assistant AI. You help users with tax-related questions, form completion, and tax planning.

Key capabilities:
- Answer tax questions accurately
- Help fill out tax forms
- Provide tax planning advice
- Explain tax concepts clearly
- Suggest relevant forms and deductions

Guidelines:
- Always be accurate and up-to-date with tax laws
- Ask clarifying questions when needed
- Provide step-by-step guidance
- Explain complex concepts simply
- Suggest when professional help is needed`;

    if (context) {
      if (context.currentTopic) {
        prompt += `\n\nCurrent topic: ${context.currentTopic}`;
      }

      if (context.extractedData && Object.keys(context.extractedData).length > 0) {
        prompt += `\n\nExtracted user data: ${JSON.stringify(context.extractedData, null, 2)}`;
      }

      if (context.userIntent) {
        prompt += `\n\nUser intent: ${context.userIntent}`;
      }

      if (context.conversationState) {
        prompt += `\n\nConversation state: ${context.conversationState}`;
      }

      if (context.pendingActions && context.pendingActions.length > 0) {
        prompt += `\n\nPending actions: ${context.pendingActions.join(', ')}`;
      }
    }

    return prompt;
  }

  /**
   * Handle OpenAI API errors
   */
  private handleOpenAIError(error: any): Error {
    if (error instanceof OpenAI.APIError) {
      logger.error('OpenAI API error', {
        status: error.status,
        message: error.message,
        type: error.type,
      });

      switch (error.status) {
        case 401:
          return new Error('OpenAI API authentication failed');
        case 429:
          return new Error('OpenAI API rate limit exceeded');
        case 500:
          return new Error('OpenAI API server error');
        default:
          return new Error(`OpenAI API error: ${error.message}`);
      }
    }

    return error;
  }

  /**
   * Get model information
   */
  async getModelInfo(model: string = config.openai.model): Promise<any> {
    try {
      if (this.isTestEnvironment || !config.openai.apiKey || !this.client) {
        return null; // Return null in test environment
      }
      const models = await this.client.models.list();
      const modelInfo = models.data.find(m => m.id === model);
      
      return modelInfo || null;
    } catch (error) {
      logger.error('Failed to get model info', { error, model });
      return null;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (this.isTestEnvironment || !config.openai.apiKey || !this.client) {
        return true; // Always return true in test environment
      }
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.error('OpenAI connection test failed', { error });
      return false;
    }
  }

  /**
   * Generate mock chat completion for testing
   */
  private getMockChatCompletion(
    messages: IMessage[],
    options: any = {}
  ): OpenAI.Chat.Completions.ChatCompletion {
    const lastMessage = messages[messages.length - 1];
    const mockResponse = `Mock AI response to: ${lastMessage?.content || 'user message'}`;

    return {
      id: 'chatcmpl-mock-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: options.model || config.openai.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: mockResponse,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 20,
        total_tokens: 70,
      },
    } as OpenAI.Chat.Completions.ChatCompletion;
  }

  /**
   * Generate mock streaming completion for testing
   */
  private async* getMockStreamingCompletion(
    messages: IMessage[],
    options: any = {}
  ): AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> {
    const lastMessage = messages[messages.length - 1];
    const mockResponse = `Mock AI response to: ${lastMessage?.content || 'user message'}`;
    const words = mockResponse.split(' ');

    for (let i = 0; i < words.length; i++) {
      const chunk: OpenAI.Chat.Completions.ChatCompletionChunk = {
        id: 'chatcmpl-mock-' + Date.now(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: options.model || config.openai.model,
        choices: [
          {
            index: 0,
            delta: {
              content: (i === 0 ? '' : ' ') + words[i],
            },
            finish_reason: i === words.length - 1 ? 'stop' : null,
          },
        ],
      };
      
      yield chunk;
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Generate mock tax intent analysis for testing
   */
  private getMockTaxIntent(text: string): {
    intent: string;
    entities: any[];
    confidence: number;
    suggestions: string[];
  } {
    return {
      intent: 'general_inquiry',
      entities: [
        {
          type: 'form',
          value: '1040',
          confidence: 0.8
        }
      ],
      confidence: 0.7,
      suggestions: [
        'Consider reviewing your income sources',
        'Check if you qualify for any deductions'
      ]
    };
  }

  /**
   * Generate mock tax form suggestions for testing
   */
  private getMockTaxFormSuggestions(userInfo: any): {
    recommendedForms: string[];
    reasoning: string;
    additionalQuestions: string[];
  } {
    return {
      recommendedForms: ['1040', 'Schedule A'],
      reasoning: 'Based on your information, Form 1040 is required for individual tax filing, and Schedule A may be beneficial if you have itemized deductions.',
      additionalQuestions: [
        'Do you have mortgage interest to deduct?',
        'Did you make charitable contributions?',
        'Do you have state and local tax payments?'
      ]
    };
  }

  /**
   * Generate mock tax validation for testing
   */
  private getMockTaxValidation(formData: any, calculations: any): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  } {
    return {
      isValid: true,
      errors: [],
      warnings: ['This is a mock validation in test environment'],
      suggestions: [
        'Review all calculations manually',
        'Consider consulting a tax professional for complex situations'
      ]
    };
  }
}

// Export singleton instance
export const openaiService = OpenAIService.getInstance();