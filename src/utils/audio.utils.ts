import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface AudioFileInfo {
  size: number;
  duration?: number;
  format: string;
}

export class AudioUtils {
  static getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.opus': 'audio/opus',
      '.webm': 'audio/webm',
    };
    return mimeTypes[ext] || 'audio/ogg';
  }

  static isValidAudioFormat(mimeType: string, supportedFormats: string[]): boolean {
    return supportedFormats.includes(mimeType);
  }

  static getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      logger.error(`Failed to get file size for ${filePath}:`, error);
      return 0;
    }
  }

  static generateTempFileName(phoneNumber: string, extension: string = '.ogg'): string {
    const timestamp = Date.now();
    const sanitizedPhone = phoneNumber.replace(/[^a-zA-Z0-9]/g, '');
    return `voice_${timestamp}_${sanitizedPhone}${extension}`;
  }

  static cleanupOldFiles(directory: string, maxAgeMs: number = 3600000): void {
    try {
      const files = fs.readdirSync(directory);
      const now = Date.now();

      files.forEach(file => {
        if (file.startsWith('voice_')) {
          const filePath = path.join(directory, file);
          const stats = fs.statSync(filePath);
          
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            logger.debug(`Cleaned up old audio file: ${file}`);
          }
        }
      });
    } catch (error) {
      logger.error('Error cleaning up audio files:', error);
    }
  }

  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create directory ${dirPath}:`, error);
      throw error;
    }
  }

  static formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  static estimateTranscriptionTime(fileSize: number): number {
    // Rough estimation: ~1 second per 100KB
    return Math.max(2000, Math.min(30000, fileSize / 100));
  }
}

export const audioUtils = AudioUtils;