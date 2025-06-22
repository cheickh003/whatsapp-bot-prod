import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import { logger } from '../utils/logger';

export interface ParsedDocument {
  text: string;
  metadata?: {
    title?: string | undefined;
    author?: string | undefined;
    pages?: number | undefined;
    sheets?: string[] | undefined;
  };
}

export class DocumentParserService {
  async parseDocument(
    filePath: string,
    mimeType: string
  ): Promise<ParsedDocument | null> {
    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.parsePDF(filePath);
          
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          return await this.parseWord(filePath);
          
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
          return await this.parseExcel(filePath);
          
        case 'text/plain':
        case 'text/csv':
          return await this.parseText(filePath);
          
        default:
          logger.error(`Unsupported file type: ${mimeType}`);
          return null;
      }
    } catch (error) {
      logger.error('Error parsing document:', error);
      return null;
    }
  }

  private async parsePDF(filePath: string): Promise<ParsedDocument> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    return {
      text: data.text,
      metadata: {
        pages: data.numpages,
        title: data.info?.Title || undefined,
        author: data.info?.Author || undefined
      }
    };
  }

  private async parseWord(filePath: string): Promise<ParsedDocument> {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    
    if (result.messages.length > 0) {
      logger.warn('Word parsing warnings:', result.messages);
    }
    
    return {
      text: result.value
    };
  }

  private async parseExcel(filePath: string): Promise<ParsedDocument> {
    const workbook = xlsx.readFile(filePath);
    let fullText = '';
    const sheetNames: string[] = [];
    
    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      sheetNames.push(sheetName);
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;
      
      // Convert to CSV format for easier text extraction
      const csv = xlsx.utils.sheet_to_csv(worksheet);
      fullText += `\n\n=== Sheet: ${sheetName} ===\n${csv}`;
    }
    
    return {
      text: fullText.trim(),
      metadata: {
        sheets: sheetNames
      }
    };
  }

  private async parseText(filePath: string): Promise<ParsedDocument> {
    const text = fs.readFileSync(filePath, 'utf-8');
    return { text };
  }

  // Split text into chunks for better RAG processing
  splitIntoChunks(text: string, chunkSize: number = 1000): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    let currentSize = 0;
    
    for (const sentence of sentences) {
      if (currentSize + sentence.length > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Add overlap by including last few sentences
        const overlapText = currentChunk.split('.').slice(-2).join('.').trim();
        currentChunk = overlapText ? overlapText + '. ' + sentence : sentence;
        currentSize = currentChunk.length;
      } else {
        currentChunk += sentence + ' ';
        currentSize = currentChunk.length;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Extract key information for quick access
  extractKeyInfo(text: string): { [key: string]: string } {
    const keyInfo: { [key: string]: string } = {};
    
    // Extract emails
    const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g);
    if (emails) {
      keyInfo.emails = emails.join(', ');
    }
    
    // Extract phone numbers
    const phones = text.match(/[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3,5}[-\s\.]?[0-9]{3,5}/g);
    if (phones) {
      keyInfo.phones = phones.join(', ');
    }
    
    // Extract dates
    const dates = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/g);
    if (dates) {
      keyInfo.dates = dates.join(', ');
    }
    
    // Extract amounts/prices
    const amounts = text.match(/[$€£]\s*\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|XOF|FCFA)/gi);
    if (amounts) {
      keyInfo.amounts = amounts.join(', ');
    }
    
    return keyInfo;
  }
}

export const documentParserService = new DocumentParserService();