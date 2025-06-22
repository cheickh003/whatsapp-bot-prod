import { appwriteService } from './appwrite.service';
import { Admin, AdminSession, BotMode } from '../models/admin.model';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';
import { Query, ID } from 'node-appwrite';

export class AdminService {
  private sessions: Map<string, AdminSession> = new Map();
  private readonly SESSION_DURATION = 15 * 60 * 1000; // 15 minutes
  private botMode: BotMode = BotMode.NORMAL;
  private readonly ADMIN_COLLECTION = 'admins';
  private readonly CONFIG_COLLECTION = 'bot_config';
  private readonly BLACKLIST_COLLECTION = 'blacklist';
  private readonly USER_LIMITS_COLLECTION = 'user_limits';
  private readonly AUDIT_COLLECTION = 'admin_audit';

  async initialize(): Promise<void> {
    try {
      // Ensure admin collections exist
      await this.ensureCollections();
      
      // Load bot mode from config
      const modeConfig = await this.getConfig('bot_mode');
      if (modeConfig) {
        this.botMode = modeConfig as BotMode;
      }
      
      // Initialize default admin if none exists
      await this.initializeDefaultAdmin();
      
      logger.info('Admin service initialized');
    } catch (error: any) {
      logger.error('Failed to initialize admin service:', error);
    }
  }

  private async ensureCollections(): Promise<void> {
    // Admins collection
    await appwriteService.ensureCollection(this.ADMIN_COLLECTION, [
      { key: 'phoneNumber', type: 'string', size: 50, required: true },
      { key: 'pin', type: 'string', size: 255, required: true },
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'createdAt', type: 'datetime', required: true },
      { key: 'lastAuth', type: 'datetime', required: false },
      { key: 'sessionExpiry', type: 'datetime', required: false }
    ]);

    // Config collection
    await appwriteService.ensureCollection(this.CONFIG_COLLECTION, [
      { key: 'key', type: 'string', size: 100, required: true },
      { key: 'value', type: 'string', size: 1000, required: true },
      { key: 'updatedAt', type: 'datetime', required: true },
      { key: 'updatedBy', type: 'string', size: 50, required: true }
    ]);

    // Blacklist collection
    await appwriteService.ensureCollection(this.BLACKLIST_COLLECTION, [
      { key: 'phoneNumber', type: 'string', size: 50, required: true },
      { key: 'reason', type: 'string', size: 500, required: true },
      { key: 'blockedAt', type: 'datetime', required: true },
      { key: 'blockedBy', type: 'string', size: 50, required: true }
    ]);

    // User limits collection
    await appwriteService.ensureCollection(this.USER_LIMITS_COLLECTION, [
      { key: 'phoneNumber', type: 'string', size: 50, required: true },
      { key: 'dailyLimit', type: 'integer', required: true },
      { key: 'messagesUsed', type: 'integer', required: true },
      { key: 'resetAt', type: 'datetime', required: true }
    ]);

    // Audit log collection
    await appwriteService.ensureCollection(this.AUDIT_COLLECTION, [
      { key: 'adminPhone', type: 'string', size: 50, required: true },
      { key: 'command', type: 'string', size: 100, required: true },
      { key: 'parameters', type: 'string', size: 1000, required: false },
      { key: 'timestamp', type: 'datetime', required: true },
      { key: 'success', type: 'boolean', required: true },
      { key: 'error', type: 'string', size: 1000, required: false }
    ]);
  }

  private async initializeDefaultAdmin(): Promise<void> {
    try {
      const admins = await appwriteService.listDocuments(this.ADMIN_COLLECTION);
      
      if (admins.total === 0) {
        // Create default admin with your phone number
        const defaultPin = '1234'; // Change this!
        const hashedPin = this.hashPin(defaultPin);
        
        await appwriteService.createDocument(this.ADMIN_COLLECTION, ID.unique(), {
          phoneNumber: '2250703079410@c.us',
          pin: hashedPin,
          name: 'Cheickh (Default Admin)',
          createdAt: new Date().toISOString()
        });
        
        logger.info('Default admin created. PIN: 1234 (PLEASE CHANGE!)');
      }
    } catch (error: any) {
      logger.error('Failed to initialize default admin:', error);
    }
  }

  private hashPin(pin: string): string {
    return crypto.createHash('sha256').update(pin).digest('hex');
  }

  async authenticate(phoneNumber: string, pin: string): Promise<boolean> {
    try {
      const admins = await appwriteService.listDocuments(
        this.ADMIN_COLLECTION,
        [Query.equal('phoneNumber', phoneNumber)]
      );

      if (admins.total === 0) {
        await this.logAudit(phoneNumber, 'auth', pin, false, 'Not an admin');
        return false;
      }

      const admin = admins.documents[0] as Admin;
      const hashedPin = this.hashPin(pin);

      if (admin.pin !== hashedPin) {
        await this.logAudit(phoneNumber, 'auth', '', false, 'Invalid PIN');
        return false;
      }

      // Create session
      const session: AdminSession = {
        phoneNumber,
        authenticated: true,
        expiresAt: new Date(Date.now() + this.SESSION_DURATION)
      };

      this.sessions.set(phoneNumber, session);

      // Update last auth
      await appwriteService.updateDocument(this.ADMIN_COLLECTION, admin.$id!, {
        lastAuth: new Date().toISOString(),
        sessionExpiry: session.expiresAt.toISOString()
      });

      await this.logAudit(phoneNumber, 'auth', '', true);
      logger.info(`Admin authenticated: ${phoneNumber}`);
      return true;
    } catch (error: any) {
      logger.error('Authentication error:', error);
      return false;
    }
  }

  isAuthenticated(phoneNumber: string): boolean {
    const session = this.sessions.get(phoneNumber);
    
    if (!session) return false;
    
    if (new Date() > session.expiresAt) {
      this.sessions.delete(phoneNumber);
      return false;
    }
    
    return session.authenticated;
  }

  async isAdmin(phoneNumber: string): Promise<boolean> {
    try {
      const admins = await appwriteService.listDocuments(
        this.ADMIN_COLLECTION,
        [Query.equal('phoneNumber', phoneNumber)]
      );
      
      return admins.total > 0;
    } catch (error: any) {
      logger.error('Error checking admin status:', error);
      return false;
    }
  }

  async isBlacklisted(phoneNumber: string): Promise<boolean> {
    try {
      const blacklist = await appwriteService.listDocuments(
        this.BLACKLIST_COLLECTION,
        [Query.equal('phoneNumber', phoneNumber)]
      );
      
      return blacklist.total > 0;
    } catch (error: any) {
      logger.error('Error checking blacklist:', error);
      return false;
    }
  }

  async checkUserLimit(phoneNumber: string): Promise<boolean> {
    try {
      const limits = await appwriteService.listDocuments(
        this.USER_LIMITS_COLLECTION,
        [Query.equal('phoneNumber', phoneNumber)]
      );

      if (limits.total === 0) return true; // No limit set

      const limit = limits.documents[0];
      const resetTime = new Date(limit.resetAt);
      
      // Reset if needed
      if (new Date() > resetTime) {
        await appwriteService.updateDocument(
          this.USER_LIMITS_COLLECTION,
          limit.$id,
          {
            messagesUsed: 0,
            resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          }
        );
        return true;
      }

      return limit.messagesUsed < limit.dailyLimit;
    } catch (error: any) {
      logger.error('Error checking user limit:', error);
      return true; // Allow on error
    }
  }

  async incrementUserUsage(phoneNumber: string): Promise<void> {
    try {
      const limits = await appwriteService.listDocuments(
        this.USER_LIMITS_COLLECTION,
        [Query.equal('phoneNumber', phoneNumber)]
      );

      if (limits.total > 0) {
        const limit = limits.documents[0];
        await appwriteService.updateDocument(
          this.USER_LIMITS_COLLECTION,
          limit.$id,
          {
            messagesUsed: limit.messagesUsed + 1
          }
        );
      }
    } catch (error: any) {
      logger.error('Error incrementing user usage:', error);
    }
  }

  getBotMode(): BotMode {
    return this.botMode;
  }

  async setBotMode(mode: BotMode, adminPhone: string): Promise<void> {
    this.botMode = mode;
    await this.setConfig('bot_mode', mode, adminPhone);
  }

  async getConfig(key: string): Promise<string | null> {
    try {
      const configs = await appwriteService.listDocuments(
        this.CONFIG_COLLECTION,
        [Query.equal('key', key)]
      );

      if (configs.total > 0) {
        return configs.documents[0].value;
      }
      
      return null;
    } catch (error: any) {
      logger.error('Error getting config:', error);
      return null;
    }
  }

  async setConfig(key: string, value: string, adminPhone: string): Promise<void> {
    try {
      const configs = await appwriteService.listDocuments(
        this.CONFIG_COLLECTION,
        [Query.equal('key', key)]
      );

      const data = {
        key,
        value,
        updatedAt: new Date().toISOString(),
        updatedBy: adminPhone
      };

      if (configs.total > 0) {
        await appwriteService.updateDocument(
          this.CONFIG_COLLECTION,
          configs.documents[0].$id,
          data
        );
      } else {
        await appwriteService.createDocument(this.CONFIG_COLLECTION, ID.unique(), data);
      }
    } catch (error: any) {
      logger.error('Error setting config:', error);
    }
  }

  async logAudit(
    adminPhone: string, 
    command: string, 
    parameters: string = '', 
    success: boolean = true,
    error?: string
  ): Promise<void> {
    try {
      await appwriteService.createDocument(this.AUDIT_COLLECTION, ID.unique(), {
        adminPhone,
        command,
        parameters,
        timestamp: new Date().toISOString(),
        success,
        error: error || ''
      });
    } catch (err) {
      logger.error('Error logging audit:', err);
    }
  }

  async notifyAdmins(_message: string, excludePhone?: string): Promise<string[]> {
    try {
      const admins = await appwriteService.listDocuments(this.ADMIN_COLLECTION);
      const notified: string[] = [];
      
      for (const admin of admins.documents) {
        if (admin.phoneNumber !== excludePhone) {
          // Return phone numbers to notify (actual sending will be done by caller)
          notified.push(admin.phoneNumber);
        }
      }
      
      return notified;
    } catch (error: any) {
      logger.error('Error notifying admins:', error);
      return [];
    }
  }
}

export const adminService = new AdminService();