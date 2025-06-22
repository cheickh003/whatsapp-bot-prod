import { appwriteService } from './appwrite.service';
import { aiService } from './ai.service';
import { HumanMessage } from '@langchain/core/messages';
import { logger } from '../utils/logger';
import { ChatContext } from '../types';

export class MemoryService {
  private maxHistoryLength: number = 20;

  async loadConversationContext(phoneNumber: string): Promise<ChatContext> {
    try {
      logger.info(`Loading conversation context for ${phoneNumber}`);
      
      const conversation = await appwriteService.getOrCreateConversation(phoneNumber);
      logger.info(`Got conversation ID: ${conversation.$id}`);
      
      const messages = await appwriteService.getConversationHistory(conversation.$id, this.maxHistoryLength);
      logger.info(`Loaded ${messages.length} messages from database`);
      
      const messageHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      return {
        conversationId: conversation.$id,
        phoneNumber,
        messageHistory,
      };
    } catch (error) {
      logger.error('Error loading conversation context:', error);
      throw error;
    }
  }

  async saveUserMessage(conversationId: string, content: string): Promise<void> {
    try {
      await appwriteService.saveMessage(conversationId, 'user', content);
    } catch (error) {
      logger.error('Error saving user message:', error);
      throw error;
    }
  }

  async saveAssistantMessage(conversationId: string, content: string): Promise<void> {
    try {
      await appwriteService.saveMessage(conversationId, 'assistant', content);
    } catch (error) {
      logger.error('Error saving assistant message:', error);
      throw error;
    }
  }

  async processMessageWithMemory(phoneNumber: string, userMessage: string): Promise<string> {
    try {
      logger.info(`Processing message with memory for ${phoneNumber}`);
      
      // First load context to get existing history
      const context = await this.loadConversationContext(phoneNumber);
      
      // Convert history to BaseMessage array
      const historyMessages = aiService.convertHistoryToMessages(context.messageHistory);
      
      // Add current message to history
      historyMessages.push(new HumanMessage(userMessage));
      
      logger.info(`Processing with ${historyMessages.length} total messages (${context.messageHistory.length} from DB + 1 current)`);
      
      if (historyMessages.length > 1) {
        logger.info('Last 4 messages being sent to AI:');
        historyMessages.slice(-4).forEach((msg, idx) => {
          const role = msg instanceof HumanMessage ? 'Human' : 'AI';
          const content = msg.content.toString();
          logger.info(`  ${idx + 1}. [${role}]: ${content.substring(0, 80)}...`);
        });
      }
      
      // Get AI response with full history
      const response = await aiService.processMessage(
        context.conversationId,
        userMessage,
        historyMessages
      );
      
      // Save both messages to database AFTER getting response
      await this.saveUserMessage(context.conversationId, userMessage);
      await this.saveAssistantMessage(context.conversationId, response);
      
      logger.info(`Response generated and saved for ${phoneNumber}`);
      
      return response;
    } catch (error) {
      logger.error('Error processing message with memory:', error);
      throw error;
    }
  }

  async clearConversation(phoneNumber: string): Promise<void> {
    try {
      const conversation = await appwriteService.getOrCreateConversation(phoneNumber);
      await appwriteService.deleteConversation(conversation.$id);
      aiService.clearConversation(conversation.$id);
      logger.info(`Cleared conversation for ${phoneNumber}`);
    } catch (error) {
      logger.error('Error clearing conversation:', error);
      throw error;
    }
  }

  setMaxHistoryLength(length: number): void {
    this.maxHistoryLength = length;
  }

  getMaxHistoryLength(): number {
    return this.maxHistoryLength;
  }
}

export const memoryService = new MemoryService();