import { whatsappService } from './whatsapp.service';
import { appwriteService } from './appwrite.service';
import { logger } from '../utils/logger';
import { ID, Query } from 'node-appwrite';

export class ScheduledMessageService {
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 30000; // Check every 30 seconds

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing scheduled message service...');
      
      // Ensure collection exists
      await this.ensureScheduledMessagesCollection();
      
      // Start the scheduler
      this.startScheduler();
      
      logger.info('Scheduled message service initialized successfully');
    } catch (error) {
      logger.error('Error initializing scheduled message service:', error);
    }
  }

  private async ensureScheduledMessagesCollection(): Promise<void> {
    const attributes = [
      { key: 'phoneNumber', type: 'string', size: 255, required: true },
      { key: 'message', type: 'string', size: 5000, required: true },
      { key: 'scheduledTime', type: 'datetime', required: true },
      { key: 'status', type: 'string', size: 50, required: true },
      { key: 'createdBy', type: 'string', size: 255, required: true },
      { key: 'createdAt', type: 'datetime', required: true },
      { key: 'sentAt', type: 'datetime', required: false },
      { key: 'error', type: 'string', size: 500, required: false },
      { key: 'cancelledBy', type: 'string', size: 255, required: false },
      { key: 'cancelledAt', type: 'datetime', required: false }
    ];
    
    await appwriteService.ensureCollection('scheduled_messages', attributes);
  }

  async scheduleMessage(
    phoneNumber: string, 
    message: string, 
    scheduledTime: Date,
    createdBy: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Validate scheduled time is in the future
      if (scheduledTime <= new Date()) {
        return { 
          success: false, 
          error: 'La date programmée doit être dans le futur' 
        };
      }

      // Create scheduled message document
      const doc = await appwriteService.createDocument(
        'scheduled_messages',
        ID.unique(),
        {
          phoneNumber,
          message,
          scheduledTime: scheduledTime.toISOString(),
          status: 'pending',
          createdBy,
          createdAt: new Date().toISOString()
        }
      );

      logger.info(`Message programmé créé: ${doc.$id} pour ${scheduledTime.toISOString()}`);

      return { 
        success: true, 
        messageId: doc.$id 
      };
    } catch (error: any) {
      logger.error('Erreur lors de la programmation du message:', error);
      return { 
        success: false, 
        error: error.message || 'Erreur inconnue' 
      };
    }
  }

  async cancelScheduledMessage(messageId: string, cancelledBy: string): Promise<boolean> {
    try {
      // Check if message exists and is pending
      const message = await appwriteService.getDocument('scheduled_messages', messageId);
      
      if (!message || message.status !== 'pending') {
        return false;
      }

      // Update status to cancelled
      await appwriteService.updateDocument(
        'scheduled_messages',
        messageId,
        {
          status: 'cancelled',
          cancelledBy,
          cancelledAt: new Date().toISOString()
        }
      );

      logger.info(`Message programmé annulé: ${messageId}`);
      return true;
    } catch (error) {
      logger.error('Erreur lors de l\'annulation du message programmé:', error);
      return false;
    }
  }

  async listScheduledMessages(phoneNumber?: string): Promise<any[]> {
    try {
      const queries = [
        Query.equal('status', 'pending'),
        Query.orderDesc('scheduledTime')
      ];

      if (phoneNumber) {
        queries.unshift(Query.equal('createdBy', phoneNumber));
      }

      const result = await appwriteService.listDocuments(
        'scheduled_messages',
        queries,
        100
      );

      return result.documents || [];
    } catch (error) {
      logger.error('Erreur lors de la récupération des messages programmés:', error);
      return [];
    }
  }

  private startScheduler(): void {
    // Check for messages to send immediately on start
    this.checkAndSendScheduledMessages();

    // Then check periodically
    this.checkInterval = setInterval(() => {
      this.checkAndSendScheduledMessages();
    }, this.CHECK_INTERVAL);

    logger.info('Vérificateur de messages programmés démarré');
  }

  private async checkAndSendScheduledMessages(): Promise<void> {
    try {
      const now = new Date();
      
      // Get all pending messages
      const result = await appwriteService.listDocuments(
        'scheduled_messages',
        [
          Query.equal('status', 'pending'),
          Query.lessThanEqual('scheduledTime', now.toISOString())
        ],
        100
      );

      const dueMessages = result.documents || [];

      logger.debug(`Vérification des messages programmés: ${dueMessages.length} messages à envoyer`);

      // Send each due message
      for (const msg of dueMessages) {
        await this.sendScheduledMessage(msg);
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification des messages programmés:', error);
    }
  }

  private async sendScheduledMessage(msg: any): Promise<void> {
    try {
      logger.info(`Envoi du message programmé ${msg.$id} à ${msg.phoneNumber}`);

      // Send the message as a normal message (no admin labels)
      await whatsappService.sendMessage(msg.phoneNumber, msg.message);

      // Update status to sent
      await appwriteService.updateDocument(
        'scheduled_messages',
        msg.$id,
        {
          status: 'sent',
          sentAt: new Date().toISOString()
        }
      );

      logger.info(`Message programmé ${msg.$id} envoyé avec succès`);
    } catch (error: any) {
      logger.error(`Erreur lors de l'envoi du message programmé ${msg.$id}:`, error);

      // Update status to failed
      await appwriteService.updateDocument(
        'scheduled_messages',
        msg.$id,
        {
          status: 'failed',
          error: error.message || 'Erreur inconnue'
        }
      );
    }
  }

  stopScheduler(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Vérificateur de messages programmés arrêté');
    }
  }

  // Parse date/time from user input
  parseScheduleTime(input: string): Date | null {
    try {
      // Support multiple formats
      // Format 1: "25/12/2024 15:30"
      // Format 2: "demain 10h"
      // Format 3: "dans 2 heures"
      
      const now = new Date();
      
      // Check for relative time
      if (input.toLowerCase().includes('dans')) {
        const match = input.match(/dans\s+(\d+)\s+(heure|minute|jour)/i);
        if (match && match[1] && match[2]) {
          const amount = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          
          const scheduledTime = new Date(now);
          
          if (unit.includes('minute')) {
            scheduledTime.setMinutes(scheduledTime.getMinutes() + amount);
          } else if (unit.includes('heure')) {
            scheduledTime.setHours(scheduledTime.getHours() + amount);
          } else if (unit.includes('jour')) {
            scheduledTime.setDate(scheduledTime.getDate() + amount);
          }
          
          return scheduledTime;
        }
      }
      
      // Check for "demain"
      if (input.toLowerCase().includes('demain')) {
        const match = input.match(/(\d{1,2})h(\d{0,2})?/i);
        if (match && match[1]) {
          const hour = parseInt(match[1]);
          const minute = match[2] ? parseInt(match[2]) : 0;
          
          const scheduledTime = new Date(now);
          scheduledTime.setDate(scheduledTime.getDate() + 1);
          scheduledTime.setHours(hour, minute, 0, 0);
          
          return scheduledTime;
        }
      }
      
      // Check for absolute date format DD/MM/YYYY HH:mm
      const dateMatch = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3] && dateMatch[4] && dateMatch[5]) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1; // Months are 0-indexed
        const year = parseInt(dateMatch[3]);
        const hour = parseInt(dateMatch[4]);
        const minute = parseInt(dateMatch[5]);
        
        return new Date(year, month, day, hour, minute);
      }
      
      // Check for time today HH:mm
      const timeMatch = input.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch && timeMatch[1] && timeMatch[2]) {
        const hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2]);
        
        const scheduledTime = new Date(now);
        scheduledTime.setHours(hour, minute, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (scheduledTime <= now) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
        
        return scheduledTime;
      }
      
      return null;
    } catch (error) {
      logger.error('Erreur lors du parsing de la date:', error);
      return null;
    }
  }

  // Format scheduled time for display
  formatScheduledTime(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Abidjan'
    };
    
    return date.toLocaleString('fr-FR', options);
  }
}

export const scheduledMessageService = new ScheduledMessageService();