import { appwriteConfig, ID } from '../config/appwrite.config';
import { logger } from '../utils/logger';
import { Query } from 'node-appwrite';

interface MobileSession {
  adminId: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  lastActive: Date;
  pushToken?: string;
  isActive: boolean;
}

interface AdminAction {
  adminId: string;
  action: string;
  target?: string;
  details: any;
  deviceId: string;
  timestamp: Date;
  result: 'success' | 'failure';
  errorMessage?: string;
}

interface PushToken {
  adminId: string;
  token: string;
  deviceId: string;
  platform: 'android' | 'ios';
  createdAt: Date;
  isActive: boolean;
}

export class MobileAdminService {
  private databases = appwriteConfig.databases;
  private readonly DB_ID = appwriteConfig.databaseId;
  private readonly SESSIONS_COLLECTION = 'mobile_sessions';
  private readonly ACTIONS_COLLECTION = 'admin_actions_log';
  private readonly PUSH_TOKENS_COLLECTION = 'push_tokens';

  async initialize(): Promise<void> {
    logger.info('Initializing mobile admin service...');

    try {
      // Create mobile sessions collection
      await this.createMobileSessionsCollection();
      
      // Create admin actions log collection
      await this.createAdminActionsCollection();
      
      // Create push tokens collection
      await this.createPushTokensCollection();

      logger.info('Mobile admin service initialized successfully');
    } catch (error) {
      logger.error('Error initializing mobile admin service:', error);
      throw error;
    }
  }

  private async createMobileSessionsCollection(): Promise<void> {
    try {
      await this.databases.getCollection(this.DB_ID, this.SESSIONS_COLLECTION);
      logger.info(`Collection ${this.SESSIONS_COLLECTION} already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        logger.info(`Creating collection ${this.SESSIONS_COLLECTION}...`);
        await this.databases.createCollection(
          this.DB_ID,
          this.SESSIONS_COLLECTION,
          this.SESSIONS_COLLECTION,
          [],
          true
        );

        // Create attributes
        await this.databases.createStringAttribute(
          this.DB_ID,
          this.SESSIONS_COLLECTION,
          'adminId',
          255,
          true
        );
        await this.databases.createStringAttribute(
          this.DB_ID,
          this.SESSIONS_COLLECTION,
          'deviceId',
          255,
          true
        );
        await this.databases.createStringAttribute(
          this.DB_ID,
          this.SESSIONS_COLLECTION,
          'deviceName',
          255,
          true
        );
        await this.databases.createStringAttribute(
          this.DB_ID,
          this.SESSIONS_COLLECTION,
          'platform',
          50,
          true
        );
        await this.databases.createStringAttribute(
          this.DB_ID,
          this.SESSIONS_COLLECTION,
          'appVersion',
          50,
          true
        );
        await this.databases.createDatetimeAttribute(
          this.DB_ID,
          this.SESSIONS_COLLECTION,
          'lastActive',
          true
        );
        await this.databases.createStringAttribute(
          this.DB_ID,
          this.SESSIONS_COLLECTION,
          'pushToken',
          500,
          false
        );
        await this.databases.createBooleanAttribute(
          this.DB_ID,
          this.SESSIONS_COLLECTION,
          'isActive',
          true
        );

        logger.info(`Collection ${this.SESSIONS_COLLECTION} created`);
      } else {
        throw error;
      }
    }
  }

  private async createAdminActionsCollection(): Promise<void> {
    try {
      await this.databases.getCollection(this.DB_ID, this.ACTIONS_COLLECTION);
      logger.info(`Collection ${this.ACTIONS_COLLECTION} already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        logger.info(`Creating collection ${this.ACTIONS_COLLECTION}...`);
        await this.databases.createCollection(
          this.DB_ID,
          this.ACTIONS_COLLECTION,
          this.ACTIONS_COLLECTION,
          [],
          true
        );

        // Create attributes
        await this.databases.createStringAttribute(this.DB_ID, this.ACTIONS_COLLECTION, 'adminId', 255, true);
        await this.databases.createStringAttribute(this.DB_ID, this.ACTIONS_COLLECTION, 'action', 255, true);
        await this.databases.createStringAttribute(this.DB_ID, this.ACTIONS_COLLECTION, 'target', 255, false);
        await this.databases.createStringAttribute(this.DB_ID, this.ACTIONS_COLLECTION, 'details', 5000, false);
        await this.databases.createStringAttribute(this.DB_ID, this.ACTIONS_COLLECTION, 'deviceId', 255, true);
        await this.databases.createDatetimeAttribute(this.DB_ID, this.ACTIONS_COLLECTION, 'timestamp', true);
        await this.databases.createStringAttribute(this.DB_ID, this.ACTIONS_COLLECTION, 'result', 50, true);
        await this.databases.createStringAttribute(this.DB_ID, this.ACTIONS_COLLECTION, 'errorMessage', 1000, false);

        logger.info(`Collection ${this.ACTIONS_COLLECTION} created`);
      } else {
        throw error;
      }
    }
  }

  private async createPushTokensCollection(): Promise<void> {
    try {
      await this.databases.getCollection(this.DB_ID, this.PUSH_TOKENS_COLLECTION);
      logger.info(`Collection ${this.PUSH_TOKENS_COLLECTION} already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        logger.info(`Creating collection ${this.PUSH_TOKENS_COLLECTION}...`);
        await this.databases.createCollection(
          this.DB_ID,
          this.PUSH_TOKENS_COLLECTION,
          this.PUSH_TOKENS_COLLECTION,
          [],
          true
        );

        // Create attributes
        await this.databases.createStringAttribute(this.DB_ID, this.PUSH_TOKENS_COLLECTION, 'adminId', 255, true);
        await this.databases.createStringAttribute(this.DB_ID, this.PUSH_TOKENS_COLLECTION, 'token', 500, true);
        await this.databases.createStringAttribute(this.DB_ID, this.PUSH_TOKENS_COLLECTION, 'deviceId', 255, true);
        await this.databases.createStringAttribute(this.DB_ID, this.PUSH_TOKENS_COLLECTION, 'platform', 50, true);
        await this.databases.createDatetimeAttribute(this.DB_ID, this.PUSH_TOKENS_COLLECTION, 'createdAt', true);
        await this.databases.createBooleanAttribute(this.DB_ID, this.PUSH_TOKENS_COLLECTION, 'isActive', true);

        logger.info(`Collection ${this.PUSH_TOKENS_COLLECTION} created`);
      } else {
        throw error;
      }
    }
  }

  async createMobileSession(session: MobileSession): Promise<string> {
    try {
      const doc = await this.databases.createDocument(
        this.DB_ID,
        this.SESSIONS_COLLECTION,
        ID.unique(),
        {
          ...session,
          lastActive: session.lastActive.toISOString()
        }
      );
      return doc.$id;
    } catch (error) {
      logger.error('Error creating mobile session:', error);
      throw error;
    }
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await this.databases.updateDocument(
        this.DB_ID,
        this.SESSIONS_COLLECTION,
        sessionId,
        { lastActive: new Date().toISOString() }
      );
    } catch (error) {
      logger.error('Error updating session activity:', error);
    }
  }

  async logAdminAction(action: AdminAction): Promise<void> {
    try {
      await this.databases.createDocument(
        this.DB_ID,
        this.ACTIONS_COLLECTION,
        ID.unique(),
        {
          ...action,
          details: JSON.stringify(action.details),
          timestamp: action.timestamp.toISOString()
        }
      );
    } catch (error) {
      logger.error('Error logging admin action:', error);
    }
  }

  async registerPushToken(token: PushToken): Promise<void> {
    try {
      // Deactivate old tokens for this device
      const oldTokens = await this.databases.listDocuments(
        this.DB_ID,
        this.PUSH_TOKENS_COLLECTION,
        [
          Query.equal('deviceId', [token.deviceId]),
          Query.equal('isActive', [true])
        ]
      );

      for (const oldToken of oldTokens.documents) {
        await this.databases.updateDocument(
          this.DB_ID,
          this.PUSH_TOKENS_COLLECTION,
          oldToken.$id,
          { isActive: false }
        );
      }

      // Register new token
      await this.databases.createDocument(
        this.DB_ID,
        this.PUSH_TOKENS_COLLECTION,
        ID.unique(),
        {
          ...token,
          createdAt: token.createdAt.toISOString()
        }
      );
    } catch (error) {
      logger.error('Error registering push token:', error);
      throw error;
    }
  }

  async getActiveSessions(adminId: string): Promise<any[]> {
    try {
      const sessions = await this.databases.listDocuments(
        this.DB_ID,
        this.SESSIONS_COLLECTION,
        [
          Query.equal('adminId', [adminId]),
          Query.equal('isActive', [true])
        ]
      );
      return sessions.documents;
    } catch (error) {
      logger.error('Error getting active sessions:', error);
      return [];
    }
  }

  async getAdminActions(adminId: string, limit: number = 50): Promise<any[]> {
    try {
      const actions = await this.databases.listDocuments(
        this.DB_ID,
        this.ACTIONS_COLLECTION,
        [
          Query.equal('adminId', [adminId]),
          Query.orderDesc('timestamp'),
          Query.limit(limit)
        ]
      );
      return actions.documents;
    } catch (error) {
      logger.error('Error getting admin actions:', error);
      return [];
    }
  }
}

export const mobileAdminService = new MobileAdminService();