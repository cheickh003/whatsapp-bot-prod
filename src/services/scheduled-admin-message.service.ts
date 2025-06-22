import { adminMessagingService } from './admin-messaging.service';
import { appwriteService } from './appwrite.service';
import { logger } from '../utils/logger';

export class ScheduledAdminMessageService {
  private checkInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing scheduled admin message service...');
      
      // Start the scheduler checker
      this.startScheduler();
      
      logger.info('Scheduled admin message service initialized successfully');
    } catch (error) {
      logger.error('Error initializing scheduled admin message service:', error);
    }
  }

  private startScheduler(): void {
    // Check for scheduled messages every minute
    this.checkInterval = setInterval(async () => {
      await this.checkAndSendScheduledMessages();
    }, 60000); // 60 seconds

    logger.info('Scheduled message checker started');
  }

  private async checkAndSendScheduledMessages(): Promise<void> {
    try {
      const now = new Date();
      
      // Get all scheduled messages that should be sent
      const documents = await appwriteService.listDocuments(
        'admin_messages',
        [],
        100,
        0
      );

      if (!documents || !documents.documents) {
        return;
      }

      // Filter scheduled messages that are due
      const dueMessages = documents.documents.filter((doc: any) => {
        if (doc.status !== 'scheduled' || !doc.scheduledFor) {
          return false;
        }
        const scheduledTime = new Date(doc.scheduledFor);
        return scheduledTime <= now;
      });

      // Send each due message
      for (const doc of dueMessages) {
        try {
          // Send the message
          const result = await adminMessagingService.sendMessage(
            doc.fromAdmin,
            doc.toUser,
            doc.originalMessage,
            {
              showAdminBadge: doc.showAdminBadge,
              processWithAI: doc.processWithAI,
              isSystemMessage: doc.isSystemMessage
            }
          );

          // Update status
          if (result) {
            await appwriteService.updateDocument('admin_messages', doc.$id, {
              status: 'sent',
              sentAt: new Date().toISOString()
            });
            logger.info(`Scheduled message ${doc.$id} sent successfully`);
          } else {
            await appwriteService.updateDocument('admin_messages', doc.$id, {
              status: 'failed'
            });
            logger.error(`Scheduled message ${doc.$id} failed to send`);
          }
        } catch (error) {
          logger.error(`Error processing scheduled message ${doc.$id}:`, error);
          await appwriteService.updateDocument('admin_messages', doc.$id, {
            status: 'failed'
          });
        }
      }
    } catch (error) {
      logger.error('Error checking scheduled messages:', error);
    }
  }

  stopScheduler(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Scheduled message checker stopped');
    }
  }
}

export const scheduledAdminMessageService = new ScheduledAdminMessageService();