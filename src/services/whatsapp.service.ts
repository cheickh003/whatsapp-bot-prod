import { Client, Message } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { whatsappConfig } from '../config/whatsapp.config';
import { createAuthStrategy } from '../config/session.config';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { messageFormatterService } from './message-formatter.service';
import { interactionConfig } from '../config/interaction.config';

export interface WhatsAppServiceEvents {
  ready: () => void;
  qr: (qr: string) => void;
  authenticated: () => void;
  auth_failure: (message: string) => void;
  disconnected: (reason: string) => void;
  message: (message: Message) => void;
}

export declare interface WhatsAppService {
  on<U extends keyof WhatsAppServiceEvents>(
    event: U,
    listener: WhatsAppServiceEvents[U]
  ): this;
  emit<U extends keyof WhatsAppServiceEvents>(
    event: U,
    ...args: Parameters<WhatsAppServiceEvents[U]>
  ): boolean;
}

export class WhatsAppService extends EventEmitter {
  private client: Client;
  private ready: boolean = false;

  constructor() {
    super();
    
    this.client = new Client({
      authStrategy: createAuthStrategy(),
      puppeteer: whatsappConfig.puppeteer
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('loading_screen', (percent, message) => {
      logger.info(`WhatsApp loading: ${percent}% - ${message}`);
    });

    this.client.on('qr', (qr) => {
      logger.info('QR Code received, scan it with your phone');
      qrcode.generate(qr, { small: true });
      this.emit('qr', qr);
    });

    this.client.on('ready', () => {
      logger.info('WhatsApp client is ready!');
      this.ready = true;
      this.emit('ready');
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp client authenticated');
      this.emit('authenticated');
    });

    this.client.on('auth_failure', (message) => {
      logger.error('WhatsApp authentication failed:', message);
      this.emit('auth_failure', message);
    });

    this.client.on('disconnected', (reason) => {
      logger.warn('WhatsApp client disconnected:', reason);
      this.ready = false;
      this.emit('disconnected', reason);
    });

    this.client.on('message', async (message) => {
      try {
        if (!message.from.endsWith('@c.us')) {
          return;
        }

        logger.info(`Message received from ${message.from}: ${message.body}`);
        this.emit('message', message);
      } catch (error) {
        logger.error('Error handling message:', error);
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing WhatsApp client...');
      await this.client.initialize();
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client:', error);
      throw error;
    }
  }

  async sendMessage(to: string, message: string): Promise<void> {
    if (!this.ready) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      await this.client.sendMessage(to, message);
      logger.info(`Message sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  async simulateTyping(to: string, duration: number = 3000): Promise<void> {
    if (!this.ready) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chat = await this.client.getChatById(to);
      await chat.sendStateTyping();
      await new Promise((resolve) => setTimeout(resolve, duration));
      await chat.clearState();
    } catch (error) {
      logger.error('Failed to simulate typing:', error);
    }
  }

  async sendMessageWithChunks(
    to: string, 
    message: string, 
    options?: {
      typingBetweenChunks?: boolean;
      baseDelay?: number;
      variableDelay?: boolean;
    }
  ): Promise<void> {
    if (!this.ready) {
      throw new Error('WhatsApp client is not ready');
    }

    const config = interactionConfig.humanSimulation;
    const chunks = messageFormatterService.splitMessageIntoChunks(message);
    
    logger.info(`Sending message in ${chunks.length} chunks to ${to}`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue; // Skip if chunk is undefined
      
      // Simulate reading previous message (for first chunk or after receiving a message)
      if (i === 0 && config.reading.enabled) {
        const readDelay = messageFormatterService.calculateReadDelay(message);
        logger.debug(`Reading delay: ${readDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, readDelay));
      }

      // Simulate typing
      if (options?.typingBetweenChunks !== false && config.typingIndicator.showBetweenChunks) {
        const typingDelay = messageFormatterService.calculateTypingDelay(
          chunk.text,
          options?.baseDelay || config.typing.baseDelay
        );
        
        logger.debug(`Typing delay for chunk ${i + 1}: ${typingDelay}ms`);
        await this.simulateTyping(to, typingDelay);
      }

      // Send the chunk
      await this.sendMessage(to, chunk.text);

      // Add delay between chunks (except for last chunk)
      if (!chunk.isLast) {
        let delay: number;
        
        // Calculate delay based on chunk length
        const lines = chunk.text.split('\n').length;
        if (lines <= 2) {
          delay = config.chunkDelays.afterShortMessage;
        } else if (lines <= 4) {
          delay = config.chunkDelays.afterMediumMessage;
        } else {
          delay = config.chunkDelays.afterLongMessage;
        }

        // Add variation if requested
        if (options?.variableDelay) {
          const variation = delay * 0.2;
          delay += (Math.random() - 0.5) * variation;
        }

        logger.debug(`Delay before next chunk: ${Math.round(delay)}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.info(`All ${chunks.length} chunks sent successfully`);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.ready = false;
      logger.info('WhatsApp client disconnected');
    }
  }

  getClient(): Client {
    return this.client;
  }

  getReadyState(): boolean {
    return this.ready;
  }

  isReady(): boolean {
    return this.ready;
  }
}

export const whatsappService = new WhatsAppService();