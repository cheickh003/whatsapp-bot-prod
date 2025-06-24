import { appwriteConfig, ID } from '../config/appwrite.config';
import { Query, IndexType } from 'node-appwrite';
import { Conversation, Message } from '../models/conversation.model';
import { logger } from '../utils/logger';
import { getAbidjanISOString } from '../utils/date.utils';

class AppwriteService {
  private databases = appwriteConfig.databases;
  private databaseId = appwriteConfig.databaseId;
  private collections = appwriteConfig.collections;

  async testConnection(): Promise<boolean> {
    try {
      logger.info('Testing Appwrite connection...');
      
      await this.databases.list();
      logger.info('Appwrite connection successful!');
      
      await this.ensureDatabase();
      await this.ensureCollections();
      
      return true;
    } catch (error) {
      logger.error('Appwrite connection failed:', error);
      throw new Error(`Failed to connect to Appwrite: ${error}`);
    }
  }

  private async ensureDatabase(): Promise<void> {
    try {
      await this.databases.get(this.databaseId);
      logger.info(`Database ${this.databaseId} exists`);
    } catch (error: any) {
      if (error.code === 404) {
        logger.info(`Creating database ${this.databaseId}...`);
        await this.databases.create(this.databaseId, this.databaseId);
        logger.info(`Database ${this.databaseId} created`);
      } else {
        throw error;
      }
    }
  }

  private async ensureCollections(): Promise<void> {
    await this.ensureConversationsCollection();
    await this.ensureMessagesCollection();
  }

  private async waitForAttribute(collectionId: string, attributeKey: string, maxRetries: number = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const collection = await this.databases.getCollection(this.databaseId, collectionId);
        const attributes = collection.attributes as any[] | undefined;
        const attribute = attributes?.find((attr: any) => attr.key === attributeKey);
        
        if (attribute && attribute.status === 'available') {
          logger.info(`Attribute ${attributeKey} is available`);
          return;
        }
        
        logger.info(`Waiting for attribute ${attributeKey} to be available... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error(`Error checking attribute status: ${error}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error(`Attribute ${attributeKey} did not become available after ${maxRetries} retries`);
  }

  private async ensureConversationsCollection(): Promise<void> {
    try {
      await this.databases.getCollection(this.databaseId, this.collections.conversations);
      logger.info(`Collection ${this.collections.conversations} exists`);
    } catch (error: any) {
      if (error.code === 404) {
        logger.info(`Creating collection ${this.collections.conversations}...`);
        await this.databases.createCollection(
          this.databaseId,
          this.collections.conversations,
          this.collections.conversations,
          [],
          true
        );
        
        await this.databases.createStringAttribute(
          this.databaseId,
          this.collections.conversations,
          'phoneNumber',
          255,
          true
        );
        
        await this.databases.createDatetimeAttribute(
          this.databaseId,
          this.collections.conversations,
          'createdAt',
          true
        );
        
        await this.databases.createDatetimeAttribute(
          this.databaseId,
          this.collections.conversations,
          'lastMessageAt',
          true
        );
        
        await this.waitForAttribute(this.collections.conversations, 'phoneNumber');
        await this.waitForAttribute(this.collections.conversations, 'createdAt');
        await this.waitForAttribute(this.collections.conversations, 'lastMessageAt');
        
        await this.databases.createIndex(
          this.databaseId,
          this.collections.conversations,
          'phoneNumber_idx',
          IndexType.Key,
          ['phoneNumber']
        );
        
        logger.info(`Collection ${this.collections.conversations} created`);
      } else {
        throw error;
      }
    }
  }

  private async ensureMessagesCollection(): Promise<void> {
    try {
      await this.databases.getCollection(this.databaseId, this.collections.messages);
      logger.info(`Collection ${this.collections.messages} exists`);
    } catch (error: any) {
      if (error.code === 404) {
        logger.info(`Creating collection ${this.collections.messages}...`);
        await this.databases.createCollection(
          this.databaseId,
          this.collections.messages,
          this.collections.messages,
          [],
          true
        );
        
        await this.databases.createStringAttribute(
          this.databaseId,
          this.collections.messages,
          'conversationId',
          255,
          true
        );
        
        await this.databases.createStringAttribute(
          this.databaseId,
          this.collections.messages,
          'role',
          50,
          true
        );
        
        await this.databases.createStringAttribute(
          this.databaseId,
          this.collections.messages,
          'content',
          65535,
          true
        );
        
        await this.databases.createDatetimeAttribute(
          this.databaseId,
          this.collections.messages,
          'timestamp',
          true
        );
        
        await this.waitForAttribute(this.collections.messages, 'conversationId');
        await this.waitForAttribute(this.collections.messages, 'role');
        await this.waitForAttribute(this.collections.messages, 'content');
        await this.waitForAttribute(this.collections.messages, 'timestamp');
        
        await this.databases.createIndex(
          this.databaseId,
          this.collections.messages,
          'conversation_timestamp_idx',
          IndexType.Key,
          ['conversationId', 'timestamp']
        );
        
        logger.info(`Collection ${this.collections.messages} created`);
      } else {
        throw error;
      }
    }
  }

  async getOrCreateConversation(phoneNumber: string): Promise<Conversation> {
    try {
      const conversations = await this.databases.listDocuments(
        this.databaseId,
        this.collections.conversations,
        [Query.equal('phoneNumber', phoneNumber), Query.limit(1)]
      );

      if (conversations.documents.length > 0) {
        return conversations.documents[0] as unknown as Conversation;
      }

      const now = getAbidjanISOString();
      const newConversation = await this.databases.createDocument(
        this.databaseId,
        this.collections.conversations,
        ID.unique(),
        {
          phoneNumber,
          createdAt: now,
          lastMessageAt: now,
          messageCount: 0,
        }
      );

      return newConversation as unknown as Conversation;
    } catch (error) {
      logger.error('Error getting/creating conversation:', error);
      throw error;
    }
  }

  async saveMessage(conversationId: string, role: 'user' | 'assistant', content: string): Promise<Message> {
    try {
      const message = await this.databases.createDocument(
        this.databaseId,
        this.collections.messages,
        ID.unique(),
        {
          conversationId,
          role,
          content,
          timestamp: getAbidjanISOString(),
        }
      );

      await this.databases.updateDocument(
        this.databaseId,
        this.collections.conversations,
        conversationId,
        {
          lastMessageAt: getAbidjanISOString(),
        }
      );

      return message as unknown as Message;
    } catch (error) {
      logger.error('Error saving message:', error);
      throw error;
    }
  }

  async getConversationHistory(conversationId: string, limit: number = 20): Promise<Message[]> {
    try {
      const messages = await this.databases.listDocuments(
        this.databaseId,
        this.collections.messages,
        [
          Query.equal('conversationId', conversationId),
          Query.orderDesc('timestamp'),
          Query.limit(limit),
        ]
      );

      const history = messages.documents.reverse() as unknown as Message[];
      logger.info(`Loaded ${history.length} messages from Appwrite for conversation ${conversationId}`);
      
      if (history.length > 0) {
        logger.info('First and last messages:');
        const firstMsg = history[0];
        const lastMsg = history[history.length - 1];
        if (firstMsg) {
          logger.info(`  First: [${firstMsg.role}] ${firstMsg.content.substring(0, 50)}...`);
        }
        if (lastMsg) {
          logger.info(`  Last: [${lastMsg.role}] ${lastMsg.content.substring(0, 50)}...`);
        }
      }
      
      return history;
    } catch (error) {
      logger.error('Error getting conversation history:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const messages = await this.databases.listDocuments(
        this.databaseId,
        this.collections.messages,
        [Query.equal('conversationId', conversationId)]
      );

      for (const message of messages.documents) {
        await this.databases.deleteDocument(
          this.databaseId,
          this.collections.messages,
          message.$id
        );
      }

      await this.databases.deleteDocument(
        this.databaseId,
        this.collections.conversations,
        conversationId
      );

      logger.info(`Deleted conversation ${conversationId}`);
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      throw error;
    }
  }

  // Generic methods for admin services
  async ensureCollection(
    collectionId: string, 
    attributes: Array<{key: string, type: string, size?: number, required: boolean}>
  ): Promise<void> {
    try {
      await this.databases.getCollection(this.databaseId, collectionId);
      logger.info(`Collection ${collectionId} exists`);
    } catch (error: any) {
      if (error.code === 404) {
        logger.info(`Creating collection ${collectionId}...`);
        await this.databases.createCollection(
          this.databaseId,
          collectionId,
          collectionId,
          [],
          true
        );
        
        // Create attributes
        for (const attr of attributes) {
          switch (attr.type) {
            case 'string':
              await this.databases.createStringAttribute(
                this.databaseId,
                collectionId,
                attr.key,
                attr.size || 255,
                attr.required
              );
              break;
            case 'integer':
              await this.databases.createIntegerAttribute(
                this.databaseId,
                collectionId,
                attr.key,
                attr.required
              );
              break;
            case 'boolean':
              await this.databases.createBooleanAttribute(
                this.databaseId,
                collectionId,
                attr.key,
                attr.required
              );
              break;
            case 'datetime':
              await this.databases.createDatetimeAttribute(
                this.databaseId,
                collectionId,
                attr.key,
                attr.required
              );
              break;
          }
        }
        
        // Wait for all attributes
        for (const attr of attributes) {
          await this.waitForAttribute(collectionId, attr.key);
        }
        
        logger.info(`Collection ${collectionId} created`);
      } else {
        throw error;
      }
    }
  }

  async listDocuments(
    collectionId: string,
    queries: any[] = [],
    limit: number = 25,
    offset: number = 0,
    orderAttributes?: string[],
    orderTypes?: string[]
  ): Promise<any> {
    try {
      const finalQueries = [...queries];
      
      if (limit) {
        finalQueries.push(Query.limit(limit));
      }
      
      if (offset) {
        finalQueries.push(Query.offset(offset));
      }
      
      if (orderAttributes && orderTypes && orderAttributes.length === orderTypes.length) {
        orderAttributes.forEach((attr, index) => {
          if (orderTypes[index] === 'DESC') {
            finalQueries.push(Query.orderDesc(attr));
          } else {
            finalQueries.push(Query.orderAsc(attr));
          }
        });
      }
      
      return await this.databases.listDocuments(
        this.databaseId,
        collectionId,
        finalQueries
      );
    } catch (error) {
      logger.error(`Error listing documents from ${collectionId}:`, error);
      throw error;
    }
  }

  async createDocument(collectionId: string, documentId: string, data: any): Promise<any> {
    try {
      return await this.databases.createDocument(
        this.databaseId,
        collectionId,
        documentId,
        data
      );
    } catch (error) {
      logger.error(`Error creating document in ${collectionId}:`, error);
      throw error;
    }
  }

  async updateDocument(collectionId: string, documentId: string, data: any): Promise<any> {
    try {
      return await this.databases.updateDocument(
        this.databaseId,
        collectionId,
        documentId,
        data
      );
    } catch (error) {
      logger.error(`Error updating document in ${collectionId}:`, error);
      throw error;
    }
  }

  async deleteDocument(collectionId: string, documentId: string): Promise<void> {
    try {
      await this.databases.deleteDocument(
        this.databaseId,
        collectionId,
        documentId
      );
    } catch (error) {
      logger.error(`Error deleting document from ${collectionId}:`, error);
      throw error;
    }
  }

  getDatabaseId(): string {
    return this.databaseId;
  }

  getClient() {
    return appwriteConfig.client;
  }

  // Wrapper methods for collection and attribute creation (used by Jarvis services)
  async createCollection(collectionId: string, name: string): Promise<void> {
    try {
      await this.databases.createCollection(
        this.databaseId,
        collectionId,
        name,
        [],
        true
      );
      logger.info(`Collection ${collectionId} created`);
    } catch (error: any) {
      if (error.code === 409) {
        logger.info(`Collection ${collectionId} already exists`);
      } else {
        throw error;
      }
    }
  }

  async createStringAttribute(collectionId: string, key: string, size: number, required: boolean): Promise<void> {
    try {
      await this.databases.createStringAttribute(
        this.databaseId,
        collectionId,
        key,
        size,
        required
      );
      await this.waitForAttribute(collectionId, key);
    } catch (error: any) {
      if (error.code === 409) {
        logger.info(`Attribute ${key} already exists in ${collectionId}`);
      } else {
        throw error;
      }
    }
  }

  async createIntegerAttribute(collectionId: string, key: string, required: boolean, min?: number, max?: number): Promise<void> {
    try {
      await this.databases.createIntegerAttribute(
        this.databaseId,
        collectionId,
        key,
        required,
        min,
        max
      );
      await this.waitForAttribute(collectionId, key);
    } catch (error: any) {
      if (error.code === 409) {
        logger.info(`Attribute ${key} already exists in ${collectionId}`);
      } else {
        throw error;
      }
    }
  }

  async createBooleanAttribute(collectionId: string, key: string, required: boolean): Promise<void> {
    try {
      await this.databases.createBooleanAttribute(
        this.databaseId,
        collectionId,
        key,
        required
      );
      await this.waitForAttribute(collectionId, key);
    } catch (error: any) {
      if (error.code === 409) {
        logger.info(`Attribute ${key} already exists in ${collectionId}`);
      } else {
        throw error;
      }
    }
  }

  async createDatetimeAttribute(collectionId: string, key: string, required: boolean): Promise<void> {
    try {
      await this.databases.createDatetimeAttribute(
        this.databaseId,
        collectionId,
        key,
        required
      );
      await this.waitForAttribute(collectionId, key);
    } catch (error: any) {
      if (error.code === 409) {
        logger.info(`Attribute ${key} already exists in ${collectionId}`);
      } else {
        throw error;
      }
    }
  }

  async getDocument(collectionId: string, documentId: string): Promise<any> {
    try {
      return await this.databases.getDocument(
        this.databaseId,
        collectionId,
        documentId
      );
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }
}

export const appwriteService = new AppwriteService();