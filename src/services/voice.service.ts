import { Message } from 'whatsapp-web.js';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { interactionConfig } from '../config/interaction.config';
import { whatsappService } from './whatsapp.service';
import { memoryService } from './memory.service';
import { adminService } from './admin.service';
import { openAIConfig } from '../config/openai.config';
import FormData from 'form-data';
import axios from 'axios';

export interface VoiceProcessingResult {
  success: boolean;
  transcription?: string;
  error?: string;
}

export class VoiceService {
  private processingQueue: Map<string, Promise<void>> = new Map();
  private tempDir: string;

  constructor() {
    this.tempDir = interactionConfig.voiceProcessing.tempDirectory;
    this.ensureTempDirectory();
  }

  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      logger.info(`Created temp directory for voice messages: ${this.tempDir}`);
    }
  }

  async processVoiceMessage(
    message: Message,
    phoneNumber: string
  ): Promise<void> {
    // Check if already processing a message from this user
    if (this.processingQueue.has(phoneNumber)) {
      logger.warn(`Already processing voice message from ${phoneNumber}`);
      return;
    }

    // Start processing
    const processingPromise = this.processVoiceMessageInternal(message, phoneNumber);
    this.processingQueue.set(phoneNumber, processingPromise);

    try {
      await processingPromise;
    } finally {
      this.processingQueue.delete(phoneNumber);
    }
  }

  private async processVoiceMessageInternal(
    message: Message,
    phoneNumber: string
  ): Promise<void> {
    let tempFilePath: string | null = null;

    try {
      logger.info(`Processing voice message from ${phoneNumber}`);

      // Download media
      const media = await message.downloadMedia();
      if (!media) {
        logger.error('Failed to download voice message media');
        return;
      }

      // Check file size
      const bufferSize = Buffer.byteLength(media.data, 'base64');
      if (bufferSize > interactionConfig.voiceProcessing.maxFileSize) {
        logger.error(`Voice message too large: ${bufferSize} bytes`);
        return;
      }

      // Save temporarily
      tempFilePath = path.join(this.tempDir, `voice_${Date.now()}_${phoneNumber.replace(/[^a-zA-Z0-9]/g, '')}.ogg`);
      const buffer = Buffer.from(media.data, 'base64');
      fs.writeFileSync(tempFilePath, buffer);
      logger.info(`Saved voice message to: ${tempFilePath}`);

      // Transcribe
      const transcriptionResult = await this.transcribeAudio(tempFilePath);
      
      if (!transcriptionResult.success || !transcriptionResult.transcription) {
        logger.error('Failed to transcribe voice message:', transcriptionResult.error);
        if (!interactionConfig.errorHandling.silentVoiceErrors) {
          await whatsappService.sendMessage(
            phoneNumber,
            interactionConfig.errorHandling.voiceErrorFallback
          );
        }
        return;
      }

      logger.info(`Transcription successful: "${transcriptionResult.transcription.substring(0, 100)}..."`);

      // Process as regular message
      const aiResponse = await memoryService.processMessageWithMemory(
        phoneNumber,
        transcriptionResult.transcription
      );

      // Check if user is admin
      const isAdmin = await adminService.isAdmin(phoneNumber);

      // Send response - admins always get messages in one piece
      if (isAdmin || !interactionConfig.features.messageChunking) {
        await whatsappService.sendMessage(phoneNumber, aiResponse);
      } else {
        await whatsappService.sendMessageWithChunks(
          phoneNumber,
          aiResponse,
          { typingBetweenChunks: true, variableDelay: true }
        );
      }

      // Increment usage for non-admins
      if (!isAdmin) {
        await adminService.incrementUserUsage(phoneNumber);
      }

    } catch (error) {
      logger.error('Error processing voice message:', error);
      
      if (!interactionConfig.errorHandling.silentVoiceErrors) {
        try {
          await whatsappService.sendMessage(
            phoneNumber,
            interactionConfig.errorHandling.voiceErrorFallback
          );
        } catch (sendError) {
          logger.error('Failed to send error message:', sendError);
        }
      }
    } finally {
      // Clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        logger.debug(`Cleaned up temp file: ${tempFilePath}`);
      }
    }
  }

  private async transcribeAudio(filePath: string): Promise<VoiceProcessingResult> {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      form.append('model', interactionConfig.voiceProcessing.whisperModel);
      
      if (interactionConfig.voiceProcessing.language !== 'auto') {
        form.append('language', interactionConfig.voiceProcessing.language);
      }

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${openAIConfig.apiKey}`,
          },
          timeout: interactionConfig.voiceProcessing.transcriptionTimeout,
        }
      );

      return {
        success: true,
        transcription: response.data.text,
      };
    } catch (error: any) {
      logger.error('Whisper API error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  isProcessingVoice(phoneNumber: string): boolean {
    return this.processingQueue.has(phoneNumber);
  }

  getQueueSize(): number {
    return this.processingQueue.size;
  }

  cleanup(): void {
    // Clean up old temp files
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = 3600000; // 1 hour

      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          logger.debug(`Cleaned up old temp file: ${file}`);
        }
      });
    } catch (error) {
      logger.error('Error cleaning up temp files:', error);
    }
  }
}

export const voiceService = new VoiceService();