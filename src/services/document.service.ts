import { appwriteService } from './appwrite.service';
import { logger } from '../utils/logger';
import { ID, Storage } from 'node-appwrite';
// @ts-ignore
const { InputFile } = require('node-appwrite/file');
import { documentParserService } from './document-parser.service';
import * as fs from 'fs';
import * as path from 'path';

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageId: string;
  extractedText?: string;
  chunks?: string[];
  uploadedAt: string;
  lastAccessedAt: string;
}

export class DocumentService {
  private readonly COLLECTION_ID = 'documents';
  private readonly BUCKET_ID = 'user-documents';
  private storage: Storage;
  private tempDir = '/tmp/bot-documents';

  constructor() {
    this.storage = new Storage(appwriteService.getClient());
    this.ensureTempDirectory();
  }

  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing document service...');
      
      // Create collection
      await appwriteService.createCollection(this.COLLECTION_ID, 'Documents');
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'userId', 50, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'fileName', 255, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'fileType', 50, true);
      await appwriteService.createIntegerAttribute(this.COLLECTION_ID, 'fileSize', true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'storageId', 50, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'extractedText', 1000000, false); // 1MB max
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'chunks', 1000000, false); // For storing JSON chunks
      await appwriteService.createDatetimeAttribute(this.COLLECTION_ID, 'uploadedAt', true);
      await appwriteService.createDatetimeAttribute(this.COLLECTION_ID, 'lastAccessedAt', true);

      // Create storage bucket
      try {
        await this.storage.createBucket(
          this.BUCKET_ID,
          'User Documents'
        );
        logger.info('Storage bucket created');
      } catch (error: any) {
        if (error.code === 409) {
          logger.info('Storage bucket already exists');
        } else {
          logger.error('Error creating bucket:', error);
        }
      }

      logger.info('Document service initialized successfully');
    } catch (error) {
      logger.error('Error initializing document service:', error);
      logger.warn('Document service will run with limited functionality');
    }
  }

  async uploadDocument(
    userId: string,
    fileData: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<Document | null> {
    try {
      // Validate file
      const fileSize = fileData.length;
      if (fileSize > 10 * 1024 * 1024) { // 10MB limit
        logger.error('File too large:', fileName);
        return null;
      }

      // Check user document count - temporarily disabled due to Appwrite query issue
      // TODO: Fix query and re-enable limit check
      /*
      const userDocs = await this.getUserDocuments(userId);
      if (userDocs.length >= 10) {
        logger.error('User has reached document limit');
        return null;
      }
      */

      // Save to temp file
      const tempPath = path.join(this.tempDir, `${Date.now()}_${fileName}`);
      fs.writeFileSync(tempPath, fileData);

      try {
        // Upload to Appwrite storage
        const file = await this.storage.createFile(
          this.BUCKET_ID,
          ID.unique(),
          InputFile.fromPath(tempPath, fileName)
        );

        // Create document record
        const document = await appwriteService.createDocument(
          this.COLLECTION_ID,
          ID.unique(),
          {
            userId,
            fileName,
            fileType: mimeType,
            fileSize,
            storageId: file.$id,
            uploadedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString()
          }
        );

        logger.info(`Document uploaded: ${fileName} for user ${userId}`);
        
        // Process document text and wait for it to complete
        try {
          await this.processDocumentText(document.$id, tempPath, mimeType);
          logger.info(`Text extracted successfully for document ${document.$id}`);
        } catch (error) {
          logger.error('Error processing document text:', error);
          // Continue even if text extraction fails
        }
        
        // Reload document to get updated extractedText
        const updatedDocument = await appwriteService.getDocument(this.COLLECTION_ID, document.$id);
        return this.mapDocumentFromDB(updatedDocument);

      } finally {
        // Clean up temp file
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    } catch (error) {
      logger.error('Error uploading document:', error);
      return null;
    }
  }

  async getDocument(documentId: string, userId: string): Promise<Document | null> {
    try {
      const document = await appwriteService.getDocument(this.COLLECTION_ID, documentId);
      
      // Verify ownership
      if (document.userId !== userId) {
        logger.error('Unauthorized document access attempt');
        return null;
      }

      // Update last accessed
      await appwriteService.updateDocument(this.COLLECTION_ID, documentId, {
        lastAccessedAt: new Date().toISOString()
      });

      return this.mapDocumentFromDB(document);
    } catch (error) {
      logger.error('Error getting document:', error);
      return null;
    }
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    try {
      // Temporary fix: fetch all documents and filter in memory
      // TODO: Fix Appwrite query to use proper filtering
      const documents = await appwriteService.listDocuments(
        this.COLLECTION_ID,
        [],  // No queries for now to avoid 500 error
        100,
        0,
        ['uploadedAt'],
        ['DESC']
      );

      // Filter by userId in memory
      const userDocs = documents.documents
        .filter((doc: any) => doc.userId === userId)
        .map((doc: any) => this.mapDocumentFromDB(doc));
      
      return userDocs;
    } catch (error) {
      logger.error('Error getting user documents:', error);
      return [];
    }
  }

  async deleteDocument(documentId: string, userId: string): Promise<boolean> {
    try {
      const document = await this.getDocument(documentId, userId);
      if (!document) {
        return false;
      }

      // Delete from storage
      await this.storage.deleteFile(this.BUCKET_ID, document.storageId);

      // Delete from database
      await appwriteService.deleteDocument(this.COLLECTION_ID, documentId);

      logger.info(`Document deleted: ${document.fileName}`);
      return true;
    } catch (error) {
      logger.error('Error deleting document:', error);
      return false;
    }
  }

  async downloadDocument(document: Document): Promise<Buffer | null> {
    try {
      const fileData = await this.storage.getFileDownload(
        this.BUCKET_ID,
        document.storageId
      );

      // Convert ArrayBuffer to Buffer
      return Buffer.from(fileData);
    } catch (error) {
      logger.error('Error downloading document:', error);
      return null;
    }
  }

  async updateDocumentText(documentId: string, extractedText: string, chunks: string[]): Promise<void> {
    try {
      await appwriteService.updateDocument(this.COLLECTION_ID, documentId, {
        extractedText: extractedText.substring(0, 1000000), // Limit to 1MB
        chunks: JSON.stringify(chunks)
      });
    } catch (error) {
      logger.error('Error updating document text:', error);
    }
  }

  private async processDocumentText(documentId: string, filePath: string, mimeType: string): Promise<void> {
    try {
      logger.info(`Starting text extraction for document ${documentId}, type: ${mimeType}`);
      
      // Parse the document
      const parsed = await documentParserService.parseDocument(filePath, mimeType);
      if (!parsed) {
        logger.error('Failed to parse document - parser returned null');
        return;
      }

      logger.info(`Extracted ${parsed.text.length} characters from document ${documentId}`);
      
      // Split into chunks for better search
      const chunks = documentParserService.splitIntoChunks(parsed.text, 1000);
      logger.info(`Split document into ${chunks.length} chunks`);
      
      // Update document with extracted text
      await this.updateDocumentText(documentId, parsed.text, chunks);
      
      logger.info(`Document text processed successfully for ${documentId}`);
    } catch (error) {
      logger.error('Error in processDocumentText:', error);
      throw error; // Re-throw to be caught by caller
    }
  }

  private mapDocumentFromDB(doc: any): Document {
    return {
      id: doc.$id,
      userId: doc.userId,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      storageId: doc.storageId,
      extractedText: doc.extractedText,
      chunks: doc.chunks ? JSON.parse(doc.chunks) : undefined,
      uploadedAt: doc.uploadedAt,
      lastAccessedAt: doc.lastAccessedAt
    };
  }

  async queryDocuments(userId: string, question: string): Promise<string | null> {
    try {
      const documents = await this.getUserDocuments(userId);
      if (documents.length === 0) {
        return null;
      }

      // Simple implementation: search for keywords in document text
      const keywords = question.toLowerCase().split(' ').filter(w => w.length > 2);
      let relevantTexts: string[] = [];

      for (const doc of documents) {
        const content = doc.extractedText?.toLowerCase() || '';
        
        if (!doc.extractedText) {
          logger.warn(`Document ${doc.id} has no extracted text`);
          continue;
        }
        
        // Check if any keyword matches
        const isRelevant = keywords.some(keyword => content.includes(keyword));

        if (isRelevant && doc.chunks) {
          // Get relevant chunks
          const relevantChunks = doc.chunks.filter((chunk: string) => 
            keywords.some(keyword => chunk.toLowerCase().includes(keyword))
          ).slice(0, 3);
          
          if (relevantChunks.length > 0) {
            relevantTexts.push(`📄 **${doc.fileName}:**\n${relevantChunks.join('\n\n')}`);
          }
          
          // Update last accessed
          await appwriteService.updateDocument(this.COLLECTION_ID, doc.id, {
            lastAccessedAt: new Date().toISOString()
          });
        }
      }

      if (relevantTexts.length === 0) {
        return null;
      }

      // Format response
      return `D'après vos documents:\n\n${relevantTexts.join('\n\n---\n\n')}`;
    } catch (error) {
      logger.error('Error querying documents:', error);
      return null;
    }
  }

  // Auto-cleanup old documents (30 days)
  async cleanupOldDocuments(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldDocs = await appwriteService.listDocuments(
        this.COLLECTION_ID,
        [`uploadedAt<"${thirtyDaysAgo.toISOString()}"`],
        100,
        0
      );

      for (const doc of oldDocs.documents) {
        await this.deleteDocument(doc.$id, doc.userId);
      }

      logger.info(`Cleaned up ${oldDocs.documents.length} old documents`);
    } catch (error) {
      logger.error('Error cleaning up old documents:', error);
    }
  }
}

export const documentService = new DocumentService();