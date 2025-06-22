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

export class MessageHandler {
  private typingDelay: number = 3000;
  private processingMessages: Set<string> = new Set();

  async handleMessage(message: Message): Promise<void> {
    const parsedMessage = parseWhatsAppMessage(message);
    
    if (parsedMessage.isGroupMsg) {
      logger.info(`Ignoring group message from ${parsedMessage.from}`);
      return;
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

      // Check if user is blacklisted
      if (await adminService.isBlacklisted(parsedMessage.from)) {
        logger.warn(`Blacklisted user attempted to message: ${parsedMessage.from}`);
        return; // Silently ignore
      }

      // Handle voice messages
      if (parsedMessage.type === MessageType.VOICE && interactionConfig.features.voiceMessages) {
        logger.info(`Processing voice message from ${parsedMessage.from}`);
        
        // Check if already processing a voice message from this user
        if (voiceService.isProcessingVoice(parsedMessage.from)) {
          logger.warn(`Already processing voice message from ${parsedMessage.from}`);
          return;
        }

        // Process voice message asynchronously
        voiceService.processVoiceMessage(message, parsedMessage.from).catch(error => {
          logger.error(`Failed to process voice message from ${parsedMessage.from}:`, error);
        });
        
        return; // Exit early for voice messages
      }

      // Check bot mode and admin status first
      const botMode = adminService.getBotMode();
      const isAdmin = await adminService.isAdmin(parsedMessage.from);

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
            parsedMessage.from,
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
      if (!isAdmin && !(await adminService.checkUserLimit(parsedMessage.from))) {
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

      const context = await memoryService.loadConversationContext(parsedMessage.from);
      
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
          await adminService.incrementUserUsage(parsedMessage.from);
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

      logger.info(`Processing with AI...`);
      const aiResponse = await memoryService.processMessageWithMemory(
        parsedMessage.from,
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
}

export const messageHandler = new MessageHandler();