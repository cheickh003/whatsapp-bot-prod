import { appwriteService } from './appwrite.service';
// import { whatsappService } from './whatsapp.service'; // TEMPORARILY DISABLED
import { logger } from '../utils/logger';
import { ID } from 'node-appwrite';
import { getAbidjanISOString, formatDateFR } from '../utils/date.utils';

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

export class ReminderService {
  private readonly COLLECTION_ID = 'reminders';
  private checkInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing reminder service...');
      
      // Create reminders collection
      await appwriteService.createCollection(this.COLLECTION_ID, 'Reminders');
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'phoneNumber', 50, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'message', 1000, true);
      await appwriteService.createDatetimeAttribute(this.COLLECTION_ID, 'scheduledFor', true);
      await appwriteService.createBooleanAttribute(this.COLLECTION_ID, 'recurring', true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'recurringInterval', 20, false);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'status', 20, true);
      await appwriteService.createDatetimeAttribute(this.COLLECTION_ID, 'createdAt', true);
      await appwriteService.createDatetimeAttribute(this.COLLECTION_ID, 'lastTriggered', false);
      await appwriteService.createDatetimeAttribute(this.COLLECTION_ID, 'nextTrigger', false);

      logger.info('Reminder service initialized successfully');
      
      // TEMPORARILY DISABLED: Reminder checking due to Appwrite 500 errors
      logger.warn('⚠️ Reminder checking is temporarily disabled due to Appwrite query issues');
      logger.warn('Reminders can still be created but won\'t trigger automatically');
      
      // Start the reminder checker with a delay to ensure attributes are ready
      // setTimeout(() => {
      //   this.startReminderChecker();
      // }, 5000);
    } catch (error) {
      logger.error('Error initializing reminder service:', error);
      // Don't throw the error to prevent bot from crashing
      logger.warn('Reminder service will run with limited functionality');
    }
  }

  async createReminder(
    phoneNumber: string,
    message: string,
    scheduledFor: Date,
    recurring: boolean = false,
    recurringInterval?: 'daily' | 'weekly' | 'monthly'
  ): Promise<Reminder> {
    try {
      const now = getAbidjanISOString();
      const scheduledISO = scheduledFor.toISOString();
      
      const reminder = await appwriteService.createDocument(this.COLLECTION_ID, ID.unique(), {
        phoneNumber,
        message,
        scheduledFor: scheduledISO,
        recurring,
        recurringInterval: recurringInterval || null,
        status: 'active',
        createdAt: now,
        nextTrigger: scheduledISO
      });

      logger.info(`Reminder created: ${reminder.$id} for ${phoneNumber}`);
      return this.mapToReminder(reminder);
    } catch (error) {
      logger.error('Error creating reminder:', error);
      throw error;
    }
  }

  async getUserReminders(phoneNumber: string, activeOnly: boolean = true): Promise<Reminder[]> {
    try {
      const queries = [`phoneNumber="${phoneNumber}"`];
      if (activeOnly) {
        queries.push(`status="active"`);
      }
      
      const documents = await appwriteService.listDocuments(
        this.COLLECTION_ID,
        queries,
        25,
        0,
        ['scheduledFor'],
        ['ASC']
      );

      return documents.documents.map((doc: any) => this.mapToReminder(doc));
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

  /* TEMPORARILY DISABLED - Method kept for future re-enablement
  private startReminderChecker(): void {
    // Check for reminders every minute
    this.checkInterval = setInterval(async () => {
      await this.checkAndSendReminders();
    }, 60000); // 60 seconds

    logger.info('Reminder checker started');
  }
  */

  stopReminderChecker(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Reminder checker stopped');
    }
  }

  /* TEMPORARILY DISABLED
  private async checkAndSendReminders(): Promise<void> {
    try {
      const now = new Date();
      const nowISO = now.toISOString();
      
      // Get all active reminders that should be triggered
      // For now, get all active reminders and filter in code until nextTrigger attribute is indexed
      const documents = await appwriteService.listDocuments(
        this.COLLECTION_ID,
        [
          `status="active"`
        ],
        100,
        0,
        ['scheduledFor'],
        ['ASC']
      );

      for (const doc of documents.documents) {
        const reminder = this.mapToReminder(doc);
        
        // Check if this reminder should be triggered
        const nextTriggerDate = reminder.nextTrigger ? new Date(reminder.nextTrigger) : new Date(reminder.scheduledFor);
        if (nextTriggerDate > now) {
          continue; // Skip this reminder, not time yet
        }
        
        // Send the reminder
        await this.sendReminder(reminder);
        
        // Update the reminder
        if (reminder.recurring && reminder.recurringInterval) {
          // Calculate next trigger
          const nextTrigger = this.calculateNextTrigger(
            new Date(reminder.scheduledFor),
            reminder.recurringInterval as 'daily' | 'weekly' | 'monthly'
          );
          
          await appwriteService.updateDocument(this.COLLECTION_ID, reminder.id, {
            lastTriggered: nowISO,
            nextTrigger: nextTrigger.toISOString()
          });
        } else {
          // Mark as completed if not recurring
          await appwriteService.updateDocument(this.COLLECTION_ID, reminder.id, {
            status: 'completed',
            lastTriggered: nowISO
          });
        }
      }
    } catch (error) {
      logger.error('Error checking reminders:', error);
    }
  }
  */

  /* TEMPORARILY DISABLED
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
  */

  /* TEMPORARILY DISABLED
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
  */

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
    
    // Parse absolute times like "tomorrow at 10am", "next monday at 3pm"
    // For now, return null for complex parsing
    return null;
  }

  formatReminderForWhatsApp(reminder: Reminder): string {
    const statusEmoji = {
      'active': '✅',
      'completed': '✔️',
      'cancelled': '❌'
    };

    return `${statusEmoji[reminder.status]} *Rappel*\n` +
           `━━━━━━━━━━━━━━\n` +
           `📝 ${reminder.message}\n` +
           `⏰ Prévu: ${formatDateFR(reminder.scheduledFor)}\n` +
           `${reminder.recurring && reminder.recurringInterval ? `🔄 Récurrent: ${this.translateInterval(reminder.recurringInterval)}\n` : ''}` +
           `${reminder.lastTriggered ? `✓ Dernière fois: ${formatDateFR(reminder.lastTriggered)}` : ''}`;
  }

  private translateInterval(interval: string): string {
    const translations: Record<string, string> = {
      'daily': 'Quotidien',
      'weekly': 'Hebdomadaire',
      'monthly': 'Mensuel'
    };
    return translations[interval || ''] || interval || '';
  }

  private mapToReminder(document: any): Reminder {
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
}

export const reminderService = new ReminderService();