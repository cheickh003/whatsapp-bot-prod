import { logger } from '../utils/logger';

export interface MessageChunk {
  text: string;
  index: number;
  isLast: boolean;
}

export interface ChunkingOptions {
  maxLinesPerChunk: number;
  preferredBreakPoints: string[];
  minChunkLength: number;
  maxChunkLength: number;
}

export class MessageFormatterService {
  private readonly defaultOptions: ChunkingOptions = {
    maxLinesPerChunk: 4,
    preferredBreakPoints: ['. ', '! ', '? ', '\n\n', '\n', ', ', '; '],
    minChunkLength: 50,
    maxChunkLength: 500,
  };

  splitMessageIntoChunks(message: string, options?: Partial<ChunkingOptions>): MessageChunk[] {
    const opts = { ...this.defaultOptions, ...options };
    
    // If message is short enough, return as single chunk
    const lines = message.split('\n');
    if (lines.length <= opts.maxLinesPerChunk && message.length <= opts.maxChunkLength) {
      return [{
        text: message,
        index: 0,
        isLast: true,
      }];
    }

    const chunks: MessageChunk[] = [];
    let currentChunk = '';
    let currentLineCount = 0;
    
    // Split by lines first
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || ''; // Handle potential undefined
      
      // Check if adding this line would exceed limits
      const wouldExceedLineLimit = currentLineCount >= opts.maxLinesPerChunk;
      const wouldExceedCharLimit = (currentChunk + '\n' + line).length > opts.maxChunkLength;
      
      if (currentChunk && (wouldExceedLineLimit || wouldExceedCharLimit)) {
        // Save current chunk
        chunks.push({
          text: currentChunk.trim(),
          index: chunks.length,
          isLast: false,
        });
        currentChunk = line;
        currentLineCount = 1;
      } else {
        // Add line to current chunk
        if (currentChunk) {
          currentChunk += '\n' + line;
        } else {
          currentChunk = line;
        }
        currentLineCount++;
      }
      
      // If line is too long, split it further
      if (line.length > opts.maxChunkLength) {
        const subChunks = this.splitLongLine(line, opts);
        // Reset current chunk with the last subchunk
        if (subChunks.length > 1) {
          for (let j = 0; j < subChunks.length - 1; j++) {
            chunks.push({
              text: subChunks[j] || '',
              index: chunks.length,
              isLast: false,
            });
          }
          currentChunk = subChunks[subChunks.length - 1] || '';
          currentLineCount = 1;
        }
      }
    }
    
    // Add remaining chunk
    if (currentChunk) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunks.length,
        isLast: true,
      });
    }
    
    // Mark last chunk
    if (chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      if (lastChunk) {
        lastChunk.isLast = true;
      }
    }
    
    logger.info(`Split message into ${chunks.length} chunks`);
    return chunks;
  }

  private splitLongLine(line: string, options: ChunkingOptions): string[] {
    const chunks: string[] = [];
    let remaining = line;
    
    while (remaining.length > options.maxChunkLength) {
      let splitIndex = -1;
      
      // Try to find a good break point
      for (const breakPoint of options.preferredBreakPoints) {
        const lastIndex = remaining.substring(0, options.maxChunkLength).lastIndexOf(breakPoint);
        if (lastIndex > options.minChunkLength) {
          splitIndex = lastIndex + breakPoint.length;
          break;
        }
      }
      
      // If no good break point, force split at max length
      if (splitIndex === -1) {
        splitIndex = options.maxChunkLength;
      }
      
      chunks.push(remaining.substring(0, splitIndex).trim());
      remaining = remaining.substring(splitIndex).trim();
    }
    
    if (remaining) {
      chunks.push(remaining);
    }
    
    return chunks;
  }

  calculateTypingDelay(text: string, baseDelay: number = 1500): number {
    // Calculate dynamic delay based on text length and complexity
    const words = text.split(' ').length;
    const punctuation = (text.match(/[.!?,;:]/g) || []).length;
    
    // Base calculation: ~200ms per word + extra for punctuation
    let delay = baseDelay + (words * 200) + (punctuation * 300);
    
    // Cap between reasonable limits
    delay = Math.min(Math.max(delay, 1000), 5000);
    
    // Add slight randomization (±20%)
    const variation = delay * 0.2;
    delay += (Math.random() - 0.5) * variation;
    
    return Math.round(delay);
  }

  calculateReadDelay(text: string): number {
    // Simulate time to read previous message
    const words = text.split(' ').length;
    // ~150ms per word for reading
    let delay = words * 150;
    
    // Cap between 500ms and 2000ms
    delay = Math.min(Math.max(delay, 500), 2000);
    
    // Add slight randomization
    delay += (Math.random() - 0.5) * 200;
    
    return Math.round(delay);
  }
}

export const messageFormatterService = new MessageFormatterService();