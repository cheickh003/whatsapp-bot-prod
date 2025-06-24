import { whatsappService } from './whatsapp.service';
import { aiService } from './ai.service';
import { memoryService } from './memory.service';
import { appwriteService } from './appwrite.service';
import { adminService } from './admin.service';
import { logger } from '../utils/logger';
import { ID } from 'node-appwrite';
import { HumanMessage } from '@langchain/core/messages';

export interface AdminMessage {
  id: string;
  fromAdmin: string;
  toUser: string;
  originalMessage: string;
  processedMessage?: string;
  showAdminBadge: boolean;
  processWithAI: boolean;
  isSystemMessage: boolean;
  sentAt: string;
  scheduledFor?: string;
  status: 'sent' | 'scheduled' | 'cancelled' | 'failed';
}

export interface SendMessageOptions {
  showAdminBadge?: boolean;
  processWithAI?: boolean;
  isSystemMessage?: boolean;
  scheduledFor?: Date;
}

export class AdminMessagingService {
  private readonly COLLECTION_ID = 'admin_messages';

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing admin messaging service...');
      
      // Create collection and attributes
      await appwriteService.createCollection(this.COLLECTION_ID, 'Admin Messages');
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'fromAdmin', 50, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'toUser', 50, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'originalMessage', 5000, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'processedMessage', 5000, false);
      await appwriteService.createBooleanAttribute(this.COLLECTION_ID, 'showAdminBadge', true);
      await appwriteService.createBooleanAttribute(this.COLLECTION_ID, 'processWithAI', true);
      await appwriteService.createBooleanAttribute(this.COLLECTION_ID, 'isSystemMessage', true);
      await appwriteService.createDatetimeAttribute(this.COLLECTION_ID, 'sentAt', true);
      await appwriteService.createDatetimeAttribute(this.COLLECTION_ID, 'scheduledFor', false);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'status', 20, true);

      logger.info('Admin messaging service initialized successfully');
    } catch (error) {
      logger.error('Error initializing admin messaging service:', error);
      logger.warn('Admin messaging service will run with limited functionality');
    }
  }

  async sendMessage(
    adminPhone: string,
    targetUser: string,
    message: string,
    options: SendMessageOptions = {}
  ): Promise<AdminMessage | null> {
    try {
      // Validate admin
      if (!await adminService.isAdmin(adminPhone)) {
        logger.error(`Unauthorized admin message attempt from ${adminPhone}`);
        return null;
      }

      // Ensure targetUser has correct format
      const formattedTarget = this.formatPhoneNumber(targetUser);

      // Default options
      const sendOptions = {
        showAdminBadge: true,
        processWithAI: false,
        isSystemMessage: false,
        ...options
      };

      let finalMessage = message;

      // Process with AI if requested
      if (sendOptions.processWithAI) {
        finalMessage = await this.processMessageWithAI(formattedTarget, message);
      }

      // Add admin badge if requested
      if (sendOptions.showAdminBadge) {
        finalMessage = `👑 *[Message Admin]*\n━━━━━━━━━━━━━━\n\n${finalMessage}`;
      } else if (sendOptions.isSystemMessage) {
        finalMessage = `🤖 *[Jarvis System]*\n━━━━━━━━━━━━━━\n\n${finalMessage}`;
      }

      // If scheduled, save for later
      if (sendOptions.scheduledFor) {
        return await this.scheduleMessage(
          adminPhone,
          formattedTarget,
          message,
          sendOptions
        );
      }

      // Send immediately
      await whatsappService.sendMessage(formattedTarget, finalMessage);

      // Log the message
      const adminMessage = await this.logAdminMessage(
        adminPhone,
        formattedTarget,
        message,
        finalMessage,
        sendOptions,
        'sent'
      );

      logger.info(`Admin message sent from ${adminPhone} to ${formattedTarget}`);
      return adminMessage;

    } catch (error) {
      logger.error('Error sending admin message:', error);
      return null;
    }
  }

  async sendBroadcast(
    adminPhone: string,
    targets: string[],
    message: string,
    options: SendMessageOptions = {}
  ): Promise<{ sent: number; failed: number }> {
    const results = { sent: 0, failed: 0 };

    // Validate admin
    if (!await adminService.isAdmin(adminPhone)) {
      logger.error(`Unauthorized broadcast attempt from ${adminPhone}`);
      return results;
    }

    // Send to each target
    for (const target of targets) {
      try {
        const result = await this.sendMessage(adminPhone, target, message, options);
        if (result) {
          results.sent++;
        } else {
          results.failed++;
        }
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error(`Failed to send broadcast to ${target}:`, error);
        results.failed++;
      }
    }

    logger.info(`Broadcast complete: ${results.sent} sent, ${results.failed} failed`);
    return results;
  }

  async sendToAllUsers(
    adminPhone: string,
    message: string,
    options: SendMessageOptions = {}
  ): Promise<{ sent: number; failed: number }> {
    // For now, we'll need to implement getAllActiveUsers in admin service
    // or fetch users directly here
    try {
      const conversations = await appwriteService.listDocuments(
        'conversations',
        [],
        100,
        0
      );
      
      const userPhones = conversations.documents.map((doc: any) => doc.phoneNumber);
      logger.info(`Found ${userPhones.length} users for broadcast:`, userPhones);
      return await this.sendBroadcast(adminPhone, userPhones, message, options);
    } catch (error) {
      logger.error('Error getting all users:', error);
      return { sent: 0, failed: 0 };
    }
  }

  private async processMessageWithAI(targetUser: string, message: string): Promise<string> {
    try {
      // Get user context
      const context = await memoryService.loadConversationContext(targetUser);
      
      // Create special prompt for admin message processing
      const adminPrompt = `Tu dois reformuler ce message d'un administrateur de manière naturelle et adaptée au contexte de la conversation. 
      Le message original est: "${message}"
      
      Reformule-le en gardant le sens mais en l'adaptant au style de Jarvis et au contexte de l'utilisateur.
      Ne mentionne pas que c'est un message d'admin sauf si c'est explicitement demandé.`;

      // Get AI to process the message
      const messages = aiService.convertHistoryToMessages(context.messageHistory);
      messages.push(new HumanMessage(adminPrompt));
      
      const processedMessage = await aiService.processMessage(
        context.conversationId,
        adminPrompt,
        messages
      );

      return processedMessage;
    } catch (error) {
      logger.error('Error processing message with AI:', error);
      return message; // Return original if processing fails
    }
  }

  private async scheduleMessage(
    adminPhone: string,
    targetUser: string,
    originalMessage: string,
    options: SendMessageOptions
  ): Promise<AdminMessage | null> {
    try {
      const document = await appwriteService.createDocument(
        this.COLLECTION_ID,
        ID.unique(),
        {
          fromAdmin: adminPhone,
          toUser: targetUser,
          originalMessage,
          processedMessage: null, // Will be processed when sent
          showAdminBadge: options.showAdminBadge ?? true,
          processWithAI: options.processWithAI ?? false,
          isSystemMessage: options.isSystemMessage ?? false,
          sentAt: new Date().toISOString(),
          scheduledFor: options.scheduledFor?.toISOString(),
          status: 'scheduled'
        }
      );

      const adminMessage = this.mapDocumentToAdminMessage(document);
      logger.info(`Admin message scheduled for ${options.scheduledFor?.toISOString()}`);
      return adminMessage;
    } catch (error) {
      logger.error('Error scheduling admin message:', error);
      return null;
    }
  }

  private async logAdminMessage(
    fromAdmin: string,
    toUser: string,
    originalMessage: string,
    processedMessage: string,
    options: SendMessageOptions,
    status: string
  ): Promise<AdminMessage> {
    const document = await appwriteService.createDocument(
      this.COLLECTION_ID,
      ID.unique(),
      {
        fromAdmin,
        toUser,
        originalMessage,
        processedMessage,
        showAdminBadge: options.showAdminBadge ?? true,
        processWithAI: options.processWithAI ?? false,
        isSystemMessage: options.isSystemMessage ?? false,
        sentAt: new Date().toISOString(),
        scheduledFor: options.scheduledFor?.toISOString(),
        status
      }
    );

    return this.mapDocumentToAdminMessage(document);
  }

  async getAdminMessages(adminPhone: string, limit: number = 50): Promise<AdminMessage[]> {
    try {
      const documents = await appwriteService.listDocuments(
        this.COLLECTION_ID,
        [`fromAdmin="${adminPhone}"`],
        limit,
        0,
        ['sentAt'],
        ['DESC']
      );

      return documents.documents.map((doc: any) => this.mapDocumentToAdminMessage(doc));
    } catch (error) {
      logger.error('Error getting admin messages:', error);
      return [];
    }
  }

  async getScheduledMessages(adminPhone: string): Promise<AdminMessage[]> {
    try {
      const documents = await appwriteService.listDocuments(
        this.COLLECTION_ID,
        [
          `fromAdmin="${adminPhone}"`,
          `status="scheduled"`
        ],
        100,
        0,
        ['scheduledFor'],
        ['ASC']
      );

      return documents.documents.map((doc: any) => this.mapDocumentToAdminMessage(doc));
    } catch (error) {
      logger.error('Error getting scheduled messages:', error);
      return [];
    }
  }

  async cancelScheduledMessage(adminPhone: string, messageId: string): Promise<boolean> {
    try {
      // Verify ownership
      const message = await appwriteService.getDocument(this.COLLECTION_ID, messageId);
      if (message.fromAdmin !== adminPhone) {
        logger.error('Unauthorized cancel attempt');
        return false;
      }

      await appwriteService.updateDocument(this.COLLECTION_ID, messageId, {
        status: 'cancelled'
      });

      return true;
    } catch (error) {
      logger.error('Error cancelling scheduled message:', error);
      return false;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove @c.us suffix if present to clean the input
    phone = phone.replace('@c.us', '');
    
    // Remove @ symbol at the beginning if present
    if (phone.startsWith('@')) {
      phone = phone.substring(1);
    }
    
    // Remove all non-digit characters except +
    phone = phone.replace(/[^\d+]/g, '');
    
    // If it's empty or not a valid phone number, return error
    if (!phone || (!phone.includes('+') && !/^\d+$/.test(phone))) {
      logger.error(`Invalid phone format: ${phone}`);
      throw new Error('Phone number must be in format: +225XXXXXXXXXX or 225XXXXXXXXXX');
    }
    
    // Add country code if missing
    if (!phone.startsWith('+') && !phone.startsWith('225')) {
      phone = '225' + phone; // Default to Ivory Coast
    }
    
    // Remove + if present
    phone = phone.replace('+', '');
    
    // Add @c.us suffix
    phone = `${phone}@c.us`;
    
    return phone;
  }

  private mapDocumentToAdminMessage(document: any): AdminMessage {
    return {
      id: document.$id,
      fromAdmin: document.fromAdmin,
      toUser: document.toUser,
      originalMessage: document.originalMessage,
      processedMessage: document.processedMessage,
      showAdminBadge: document.showAdminBadge,
      processWithAI: document.processWithAI,
      isSystemMessage: document.isSystemMessage,
      sentAt: document.sentAt,
      scheduledFor: document.scheduledFor,
      status: document.status
    };
  }
}

export const adminMessagingService = new AdminMessagingService();