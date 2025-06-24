import { Message } from 'whatsapp-web.js';
import { whatsappService } from '../services/whatsapp.service';
import { memoryService } from '../services/memory.service';
import { commandHandler } from './command.handler';
import { parseWhatsAppMessage, MessageType } from '../models/message.model';
import { logger } from '../utils/logger';
import { adminService } from '../services/admin.service';
import { adminSecurityService } from '../services/admin-security.service';
import { BotMode } from '../models/admin.model';
import { interactionConfig } from '../config/interaction.config';
import { voiceService } from '../services/voice.service';
import { documentService } from '../services/document.service';
import { naturalLanguageV2Handler as naturalLanguageHandler } from './natural-language-v2.handler';

export class MessageHandler {
  private typingDelay: number = 3000;
  private processingMessages: Set<string> = new Set();
  private botId: string | null = null;
  private botPhone: string | null = null;

  async handleMessage(message: Message): Promise<void> {
    const parsedMessage = parseWhatsAppMessage(message);
    
    // Get bot ID if not already cached
    if (!this.botId && whatsappService.getClient().info?.wid) {
      this.botId = whatsappService.getClient().info.wid._serialized;
      // Extract phone number without @c.us
      this.botPhone = this.botId.split('@')[0] || null;
      logger.info(`Bot ID initialized: ${this.botId}`);
      logger.info(`Bot Phone: ${this.botPhone}`);
    }
    
    // Debug logging for all messages
    logger.info(`\n=== INCOMING MESSAGE DEBUG ===`);
    logger.info(`From: ${parsedMessage.from}`);
    logger.info(`Is Group: ${parsedMessage.isGroupMsg}`);
    logger.info(`Bot ID: ${this.botId}`);
    logger.info(`Message has mentions: ${!!message.mentionedIds}`);
    logger.info(`Number of mentions: ${message.mentionedIds?.length || 0}`);
    if (message.mentionedIds && message.mentionedIds.length > 0) {
      logger.info(`Mentioned IDs type: ${typeof message.mentionedIds[0]}`);
      logger.info(`Mentioned IDs: ${JSON.stringify(message.mentionedIds.map(id => typeof id === 'string' ? id : id._serialized))}`);
    }
    logger.info(`Has quoted message: ${message.hasQuotedMsg}`);
    logger.info(`Message body: "${parsedMessage.body}"`);
    logger.info(`Author (for groups): ${parsedMessage.author || 'N/A'}`);
    
    // Handle group messages only if bot is mentioned or message is a reply to bot
    if (parsedMessage.isGroupMsg) {
      // Check if bot is explicitly mentioned
      const isBotMentioned = message.mentionedIds?.some(id => {
        // Handle both string and ChatId object formats
        const mentionId = typeof id === 'string' ? id : id._serialized;
        
        // In groups, bot is mentioned only if message.to equals bot ID AND there are mentions
        // This prevents responding to all messages where message.to contains bot ID
        const mentioned = message.to === this.botId && message.mentionedIds && message.mentionedIds.length > 0;
        
        logger.info(`Checking mention ${mentionId} against bot ID ${this.botId}: ${mentioned}`);
        logger.info(`Message.to: ${message.to}, Has mentions: ${!!message.mentionedIds}, Mention count: ${message.mentionedIds?.length || 0}`);
        
        return mentioned;
      }) || false;
      
      // Alternative check: if message.to equals bot ID and there are mentions
      const isBotMentionedAlt = message.to === this.botId && message.mentionedIds && message.mentionedIds.length > 0;
      const finalBotMentioned = isBotMentioned || isBotMentionedAlt;
      
      let isReplyToBot = false;
      
      // Check if this is a reply to a bot message
      if (message.hasQuotedMsg) {
        try {
          const quotedMsg = await message.getQuotedMessage();
          logger.info(`Quoted message from: ${quotedMsg.from}, fromMe: ${quotedMsg.fromMe}`);
          isReplyToBot = quotedMsg.fromMe || quotedMsg.from === this.botId;
        } catch (error) {
          logger.error('Error getting quoted message:', error);
        }
      }
      
      // Store message for context even if bot is not mentioned
      const userId = parsedMessage.author || parsedMessage.from;
      
      // Save message to context regardless of mention
      try {
        const context = await memoryService.loadConversationContext(userId);
        await memoryService.saveUserMessage(context.conversationId, parsedMessage.body);
        logger.info(`Stored group message from ${userId} for context`);
      } catch (error) {
        logger.error('Error saving group message for context:', error);
      }
      
      if (!finalBotMentioned && !isReplyToBot) {
        logger.info(`Ignoring group message - bot not mentioned or replied to`);
        return;
      }
      
      logger.info(`Processing group message - Bot mentioned: ${finalBotMentioned}, Reply to bot: ${isReplyToBot}`);
    }

    if (this.processingMessages.has(parsedMessage.from)) {
      logger.warn(`Already processing message from ${parsedMessage.from}`);
      return;
    }

    this.processingMessages.add(parsedMessage.from);

    try {
      // Enable debug logging if needed
      if (adminSecurityService.isDebugEnabled(parsedMessage.from)) {
        logger.info(`[DEBUG MODE] User ${parsedMessage.from} has debug enabled`);
      }

      logger.info(`\n=== NEW MESSAGE RECEIVED ===`);
      logger.info(`From: ${parsedMessage.from}`);
      logger.info(`Type: ${parsedMessage.type}`);
      logger.info(`Body: "${parsedMessage.body}"`);
      logger.info(`Time: ${new Date().toISOString()}`);

      // Use author ID for group messages, otherwise use from
      const checkUserId = parsedMessage.isGroupMsg && parsedMessage.author ? parsedMessage.author : parsedMessage.from;
      
      // Check if user is blacklisted
      if (await adminService.isBlacklisted(checkUserId)) {
        logger.warn(`Blacklisted user attempted to message: ${checkUserId}`);
        return; // Silently ignore
      }

      // Handle voice messages
      if (parsedMessage.type === MessageType.VOICE && interactionConfig.features.voiceMessages) {
        logger.info(`Processing voice message from ${parsedMessage.from}`);
        
        // Use author ID for group messages, otherwise use from
        const voiceUserId = parsedMessage.isGroupMsg && parsedMessage.author ? parsedMessage.author : parsedMessage.from;
        
        // Check if already processing a voice message from this user
        if (voiceService.isProcessingVoice(voiceUserId)) {
          logger.warn(`Already processing voice message from ${voiceUserId}`);
          return;
        }

        // Process voice message asynchronously
        voiceService.processVoiceMessage(message, voiceUserId).catch(error => {
          logger.error(`Failed to process voice message from ${voiceUserId}:`, error);
        });
        
        return; // Exit early for voice messages
      }

      // Check bot mode and admin status first
      const botMode = adminService.getBotMode();
      const isAdmin = await adminService.isAdmin(checkUserId);
      
      // Use author ID for group messages, otherwise use from (for all subsequent operations)
      const userId = parsedMessage.isGroupMsg && parsedMessage.author ? parsedMessage.author : parsedMessage.from;

      // Handle document messages
      if (parsedMessage.type === MessageType.DOCUMENT) {
        logger.info(`Processing document from ${parsedMessage.from}`);
        
        try {
          await whatsappService.sendMessage(
            parsedMessage.from,
            '📄 Document reçu! Je vais l\'analyser...'
          );

          // Download the document
          const media = await message.downloadMedia();
          if (!media) {
            throw new Error('Failed to download document');
          }

          // Extract file info from message body or media
          const fileName = parsedMessage.body || 'document.pdf';
          const mimeType = media.mimetype || 'application/octet-stream';
          const fileBuffer = Buffer.from(media.data, 'base64');

          // Upload and process the document
          const document = await documentService.uploadDocument(
            userId,
            fileBuffer,
            fileName,
            mimeType
          );

          if (document) {
            const response = `✅ Document "${fileName}" téléchargé avec succès!\n\n` +
                           `📊 Détails:\n` +
                           `• Taille: ${(fileBuffer.length / 1024).toFixed(2)} KB\n` +
                           `• Type: ${mimeType}\n\n` +
                           `Utilisez /doc query [votre question] pour poser des questions sur ce document.`;
            
            if (interactionConfig.features.messageChunking && !isAdmin) {
              await whatsappService.sendMessageWithChunks(
                parsedMessage.from,
                response,
                { typingBetweenChunks: true, variableDelay: true }
              );
            } else {
              await whatsappService.sendMessage(parsedMessage.from, response);
            }
          } else {
            throw new Error('Failed to process document');
          }
        } catch (error: any) {
          logger.error(`Failed to process document from ${parsedMessage.from}:`, error);
          const errorMsg = error.message.includes('limit') 
            ? '⚠️ Vous avez atteint la limite de 10 documents. Supprimez-en avec /doc delete [id]'
            : '❌ Erreur lors du traitement du document. Formats supportés: PDF, Word, Excel, TXT';
          
          await whatsappService.sendMessage(parsedMessage.from, errorMsg);
        }
        
        return; // Exit early for document messages
      }
      
      if (botMode === BotMode.MAINTENANCE && !isAdmin) {
        if (interactionConfig.features.messageChunking) {
          await whatsappService.sendMessageWithChunks(
            parsedMessage.from,
            '🔧 Le bot est actuellement en maintenance. Veuillez réessayer plus tard.',
            { typingBetweenChunks: true, variableDelay: true }
          );
        } else {
          await whatsappService.sendMessage(
            parsedMessage.from,
            '🔧 Le bot est actuellement en maintenance. Veuillez réessayer plus tard.'
          );
        }
        return;
      }

      // Check user limits
      if (!isAdmin && !(await adminService.checkUserLimit(userId))) {
        if (interactionConfig.features.messageChunking) {
          await whatsappService.sendMessageWithChunks(
            parsedMessage.from,
            '⚠️ Vous avez atteint votre limite de messages quotidienne. Revenez demain!',
            { typingBetweenChunks: true, variableDelay: true }
          );
        } else {
          await whatsappService.sendMessage(
            parsedMessage.from,
            '⚠️ Vous avez atteint votre limite de messages quotidienne. Revenez demain!'
          );
        }
        return;
      }
      
      await whatsappService.simulateTyping(parsedMessage.from, this.typingDelay);

      const context = await memoryService.loadConversationContext(userId);
      
      logger.info(`Loaded context - History length: ${context.messageHistory.length}`);
      if (context.messageHistory.length > 0) {
        const lastMsg = context.messageHistory[context.messageHistory.length - 1];
        if (lastMsg) {
          logger.info(`Last message in history: [${lastMsg.role}] ${lastMsg.content.substring(0, 50)}...`);
        }
      }

      const commandResponse = await commandHandler.handleCommand(parsedMessage.body, context);
      
      if (commandResponse) {
        logger.info(`Command response: ${commandResponse.substring(0, 100)}...`);
        // Admins always get messages in one piece
        if (isAdmin || !interactionConfig.features.messageChunking) {
          await whatsappService.sendMessage(parsedMessage.from, commandResponse);
        } else {
          await whatsappService.sendMessageWithChunks(
            parsedMessage.from,
            commandResponse,
            { typingBetweenChunks: true, variableDelay: true }
          );
        }
        
        // Increment usage for non-admins
        if (!isAdmin) {
          await adminService.incrementUserUsage(userId);
        }
        return;
      }

      // Don't process AI messages in readonly mode
      if (botMode === BotMode.READONLY) {
        if (interactionConfig.features.messageChunking) {
          await whatsappService.sendMessageWithChunks(
            parsedMessage.from,
            '👁️ Le bot est en mode lecture seule. Les conversations ne sont pas sauvegardées.',
            { typingBetweenChunks: true, variableDelay: true }
          );
        } else {
          await whatsappService.sendMessage(
            parsedMessage.from,
            '👁️ Le bot est en mode lecture seule. Les conversations ne sont pas sauvegardées.'
          );
        }
        return;
      }

      // Vérifier d'abord le langage naturel pour les fonctionnalités simples
      const naturalResponse = await naturalLanguageHandler.processMessage(parsedMessage.body, userId);
      
      if (naturalResponse) {
        logger.info('Natural language feature detected, responding directly');
        
        if (isAdmin || !interactionConfig.features.messageChunking) {
          await whatsappService.sendMessage(parsedMessage.from, naturalResponse);
        } else {
          await whatsappService.sendMessageWithChunks(
            parsedMessage.from,
            naturalResponse,
            { typingBetweenChunks: true, variableDelay: true }
          );
        }
        
        // Sauvegarder dans l'historique
        await memoryService.saveUserMessage(context.conversationId, parsedMessage.body);
        await memoryService.saveAssistantMessage(context.conversationId, naturalResponse);
        
        // Incrémenter l'usage pour les non-admins
        if (!isAdmin) {
          await adminService.incrementUserUsage(userId);
        }
        
        return;
      }

      logger.info(`Processing with AI...`);
      const aiResponse = await memoryService.processMessageWithMemory(
        userId,
        parsedMessage.body
      );

      logger.info(`AI Response: ${aiResponse.substring(0, 100)}...`);
      // Admins always get messages in one piece
      if (isAdmin || !interactionConfig.features.messageChunking) {
        await whatsappService.sendMessage(parsedMessage.from, aiResponse);
      } else {
        await whatsappService.sendMessageWithChunks(
          parsedMessage.from,
          aiResponse,
          { typingBetweenChunks: true, variableDelay: true }
        );
      }
      
      // Increment usage for non-admins
      if (!isAdmin) {
        await adminService.incrementUserUsage(parsedMessage.from);
      }
      
      logger.info(`=== MESSAGE PROCESSED ===\n`);
      
    } catch (error) {
      logger.error('Error handling message:', error);
      
      try {
        if (interactionConfig.features.messageChunking) {
          await whatsappService.sendMessageWithChunks(
            parsedMessage.from,
            '❌ Une erreur est survenue. Veuillez réessayer plus tard.',
            { typingBetweenChunks: false, variableDelay: false }
          );
        } else {
          await whatsappService.sendMessage(parsedMessage.from, '❌ Une erreur est survenue. Veuillez réessayer plus tard.');
        }
      } catch (sendError) {
        logger.error('Failed to send error message:', sendError);
      }
    } finally {
      this.processingMessages.delete(parsedMessage.from);
    }
  }

  setTypingDelay(delay: number): void {
    this.typingDelay = delay;
  }

  getTypingDelay(): number {
    return this.typingDelay;
  }

  isProcessing(phoneNumber: string): boolean {
    return this.processingMessages.has(phoneNumber);
  }
  
  setBotId(botId: string): void {
    this.botId = botId;
    logger.info(`Bot ID set to: ${botId}`);
  }
}

export const messageHandler = new MessageHandler();