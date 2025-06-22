import { appwriteService } from './appwrite.service';
import { whatsappService } from './whatsapp.service';
import { logger } from '../utils/logger';
import { ID } from 'node-appwrite';

interface Reminder {
  id: string;
  phoneNumber: string;
  message: string;
  scheduledFor: string;
  recurring: boolean;
  recurringInterval?: 'daily' | 'weekly' | 'monthly';
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  lastTriggered?: string;
  nextTrigger?: string;
}

export class ReminderServiceV2 {
  private readonly COLLECTION_ID = 'reminders';
  private checkInterval: NodeJS.Timeout | null = null;
  // private reminderCache: Map<string, Reminder> = new Map(); // For future use

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing reminder service V2...');
      
      // Try to create collection with better error handling
      try {
        await appwriteService.createCollection(this.COLLECTION_ID, 'Reminders');
        await this.createAttributes();
      } catch (error: any) {
        if (error.code === 409) {
          logger.info('Reminders collection already exists');
        } else {
          logger.error('Error creating reminders collection:', error);
        }
      }

      logger.info('Reminder service V2 initialized successfully');
      
      // Start with safer implementation
      setTimeout(() => {
        this.startSafeReminderChecker();
      }, 10000); // 10 second delay
    } catch (error) {
      logger.error('Error initializing reminder service V2:', error);
      logger.warn('Reminder service will run with limited functionality');
    }
  }

  private async createAttributes(): Promise<void> {
    const attributes = [
      { name: 'phoneNumber', type: 'string', size: 50, required: true },
      { name: 'message', type: 'string', size: 1000, required: true },
      { name: 'scheduledFor', type: 'datetime', required: true },
      { name: 'recurring', type: 'boolean', required: true },
      { name: 'recurringInterval', type: 'string', size: 20, required: false },
      { name: 'status', type: 'string', size: 20, required: true },
      { name: 'createdAt', type: 'datetime', required: true },
      { name: 'lastTriggered', type: 'datetime', required: false },
      { name: 'nextTrigger', type: 'datetime', required: false }
    ];

    for (const attr of attributes) {
      try {
        if (attr.type === 'string') {
          await appwriteService.createStringAttribute(
            this.COLLECTION_ID, 
            attr.name, 
            attr.size as number, 
            attr.required
          );
        } else if (attr.type === 'boolean') {
          await appwriteService.createBooleanAttribute(
            this.COLLECTION_ID, 
            attr.name, 
            attr.required
          );
        } else if (attr.type === 'datetime') {
          await appwriteService.createDatetimeAttribute(
            this.COLLECTION_ID, 
            attr.name, 
            attr.required
          );
        }
      } catch (error: any) {
        if (error.code !== 409) { // Ignore already exists errors
          logger.error(`Error creating attribute ${attr.name}:`, error.message);
        }
      }
    }
  }

  private startSafeReminderChecker(): void {
    // Use a safer approach - fetch all reminders and filter in memory
    this.checkInterval = setInterval(async () => {
      await this.safeCheckAndSendReminders();
    }, 60000); // 60 seconds

    logger.info('Safe reminder checker started');
  }

  private async safeCheckAndSendReminders(): Promise<void> {
    try {
      const now = new Date();
      
      // Try a simpler query - just get all documents
      let documents;
      try {
        documents = await appwriteService.listDocuments(
          this.COLLECTION_ID,
          [], // No filters - we'll filter in memory
          100, // Limit
          0    // Offset
        );
      } catch (error: any) {
        logger.error('Error fetching reminders, trying fallback approach:', error.message);
        return;
      }

      if (!documents || !documents.documents) {
        logger.debug('No reminder documents found');
        return;
      }

      // Filter in memory
      const activeReminders = documents.documents.filter((doc: any) => {
        return doc.status === 'active';
      });

      logger.debug(`Found ${activeReminders.length} active reminders`);

      for (const doc of activeReminders) {
        try {
          const reminder = this.mapDocumentToReminder(doc);
          const scheduledTime = new Date(reminder.scheduledFor);
          
          // Check if it's time to send this reminder
          if (scheduledTime <= now) {
            await this.sendReminder(reminder);
            
            // Update reminder status
            if (reminder.recurring && reminder.recurringInterval) {
              const nextTrigger = this.calculateNextTrigger(now, reminder.recurringInterval);
              await this.updateReminderAfterTrigger(reminder.id, nextTrigger);
            } else {
              await this.markReminderCompleted(reminder.id);
            }
          }
        } catch (error) {
          logger.error(`Error processing reminder ${doc.$id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Safe check reminders error:', error);
    }
  }

  private async sendReminder(reminder: Reminder): Promise<void> {
    try {
      const message = `🔔 *Rappel Jarvis*\n━━━━━━━━━━━━━━\n\n${reminder.message}\n\n` +
                     `${reminder.recurring && reminder.recurringInterval ? `_Ce rappel est récurrent (${this.translateInterval(reminder.recurringInterval)})_` : ''}`;
      
      await whatsappService.sendMessage(reminder.phoneNumber, message);
      logger.info(`Reminder sent to ${reminder.phoneNumber}`);
    } catch (error) {
      logger.error('Error sending reminder:', error);
    }
  }

  private async updateReminderAfterTrigger(reminderId: string, nextTrigger: Date): Promise<void> {
    try {
      await appwriteService.updateDocument(this.COLLECTION_ID, reminderId, {
        lastTriggered: new Date().toISOString(),
        nextTrigger: nextTrigger.toISOString(),
        scheduledFor: nextTrigger.toISOString()
      });
    } catch (error) {
      logger.error('Error updating reminder after trigger:', error);
    }
  }

  private async markReminderCompleted(reminderId: string): Promise<void> {
    try {
      await appwriteService.updateDocument(this.COLLECTION_ID, reminderId, {
        status: 'completed',
        lastTriggered: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error marking reminder as completed:', error);
    }
  }

  async createReminder(
    phoneNumber: string,
    message: string,
    scheduledFor: Date,
    recurring: boolean = false,
    recurringInterval?: 'daily' | 'weekly' | 'monthly'
  ): Promise<Reminder | null> {
    try {
      const reminder = {
        phoneNumber,
        message,
        scheduledFor: scheduledFor.toISOString(),
        recurring,
        recurringInterval: recurring ? recurringInterval : undefined,
        status: 'active',
        createdAt: new Date().toISOString(),
        nextTrigger: scheduledFor.toISOString()
      };

      const document = await appwriteService.createDocument(
        this.COLLECTION_ID,
        ID.unique(),
        reminder
      );

      logger.info(`Reminder created for ${phoneNumber} at ${scheduledFor.toISOString()}`);
      return this.mapDocumentToReminder(document);
    } catch (error) {
      logger.error('Error creating reminder:', error);
      return null;
    }
  }

  async getUserReminders(phoneNumber: string): Promise<Reminder[]> {
    try {
      // Fetch all and filter in memory to avoid query issues
      const documents = await appwriteService.listDocuments(
        this.COLLECTION_ID,
        [],
        100,
        0
      );

      const userReminders = documents.documents
        .filter((doc: any) => doc.phoneNumber === phoneNumber && doc.status === 'active')
        .map((doc: any) => this.mapDocumentToReminder(doc));

      return userReminders;
    } catch (error) {
      logger.error('Error getting user reminders:', error);
      return [];
    }
  }

  async cancelReminder(reminderId: string): Promise<boolean> {
    try {
      await appwriteService.updateDocument(this.COLLECTION_ID, reminderId, {
        status: 'cancelled'
      });

      logger.info(`Reminder ${reminderId} cancelled`);
      return true;
    } catch (error) {
      logger.error('Error cancelling reminder:', error);
      return false;
    }
  }

  stopReminderChecker(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Reminder checker stopped');
    }
  }

  private calculateNextTrigger(lastTrigger: Date, interval: 'daily' | 'weekly' | 'monthly'): Date {
    const next = new Date(lastTrigger);
    
    switch (interval) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    
    return next;
  }

  parseTimeString(timeStr: string): Date | null {
    // Parse relative times like "in 30 minutes", "in 2 hours"
    const relativeMatch = timeStr.match(/in\s+(\d+)\s+(minute|hour|day|week|month)s?/i);
    if (relativeMatch && relativeMatch[1] && relativeMatch[2]) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      
      const date = new Date();
      switch (unit) {
        case 'minute':
          date.setMinutes(date.getMinutes() + amount);
          break;
        case 'hour':
          date.setHours(date.getHours() + amount);
          break;
        case 'day':
          date.setDate(date.getDate() + amount);
          break;
        case 'week':
          date.setDate(date.getDate() + (amount * 7));
          break;
        case 'month':
          date.setMonth(date.getMonth() + amount);
          break;
      }
      
      return date;
    }
    
    // Parse absolute times like "tomorrow at 14:00", "2024-03-15 09:30"
    const tomorrowMatch = timeStr.match(/tomorrow\s+at\s+(\d{1,2}):(\d{2})/i);
    if (tomorrowMatch && tomorrowMatch[1] && tomorrowMatch[2]) {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      date.setHours(parseInt(tomorrowMatch[1]));
      date.setMinutes(parseInt(tomorrowMatch[2]));
      date.setSeconds(0);
      return date;
    }
    
    // Try parsing as a date string
    const parsed = new Date(timeStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    return null;
  }

  private translateInterval(interval: 'daily' | 'weekly' | 'monthly'): string {
    const translations: Record<string, string> = {
      'daily': 'quotidien',
      'weekly': 'hebdomadaire',
      'monthly': 'mensuel'
    };
    return translations[interval] || interval;
  }

  private mapDocumentToReminder(document: any): Reminder {
    return {
      id: document.$id,
      phoneNumber: document.phoneNumber,
      message: document.message,
      scheduledFor: document.scheduledFor,
      recurring: document.recurring,
      recurringInterval: document.recurringInterval,
      status: document.status,
      createdAt: document.createdAt,
      lastTriggered: document.lastTriggered,
      nextTrigger: document.nextTrigger
    };
  }

  formatReminderForWhatsApp(reminder: Reminder | null): string {
    if (!reminder) {
      return '❌ Rappel invalide';
    }

    const scheduledDate = new Date(reminder.scheduledFor);
    const dateStr = scheduledDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = scheduledDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let message = `📅 *${dateStr}*\n⏰ *${timeStr}*\n\n`;
    message += `📝 ${reminder.message}`;
    
    if (reminder.recurring && reminder.recurringInterval) {
      message += `\n\n🔄 _Récurrent: ${this.translateInterval(reminder.recurringInterval)}_`;
    }
    
    message += `\n\n🆔 ID: ${reminder.id.substring(0, 8)}`;
    
    return message;
  }
}

export const reminderServiceV2 = new ReminderServiceV2();