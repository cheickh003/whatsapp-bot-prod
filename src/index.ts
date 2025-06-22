import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../config/.env') });

import { appwriteService } from './services/appwrite.service';
import { whatsappService } from './services/whatsapp.service';
import { messageHandler } from './handlers/message.handler';
import { logger } from './utils/logger';
import { adminService } from './services/admin.service';
import { adminMaintenanceService } from './services/admin-maintenance.service';
import { ticketService } from './services/ticket.service';
import { projectService } from './services/project.service';
// import { reminderService } from './services/reminder.service';
import { reminderServiceV2 as reminderService } from './services/reminder-service-v2';
import { documentService } from './services/document.service';
import { dailyReportService } from './services/daily-report.service';

async function startBot(): Promise<void> {
  let retries = 0;
  const maxRetries = 3;
  const retryDelay = 5000;

  while (retries < maxRetries) {
    try {
      logger.info('Starting WhatsApp Chatbot...');
      
      logger.info('Checking Appwrite connection...');
      await appwriteService.testConnection();
      logger.info('Appwrite connection verified successfully!');
      
      logger.info('Initializing admin service...');
      await adminService.initialize();
      adminMaintenanceService.setStartTime(new Date());
      logger.info('Admin service initialized successfully!');
      
      logger.info('Initializing admin messaging service...');
      const { adminMessagingService } = await import('./services/admin-messaging.service');
      await adminMessagingService.initialize();
      logger.info('Admin messaging service initialized');
      
      logger.info('Initializing scheduled admin message service...');
      const { scheduledAdminMessageService } = await import('./services/scheduled-admin-message.service');
      await scheduledAdminMessageService.initialize();
      logger.info('Scheduled admin message service initialized');
      
      logger.info('Initializing document service...');
      await documentService.initialize();
      logger.info('Document service initialized');
      
      logger.info('Initializing mobile admin service...');
      const { mobileAdminService } = await import('./services/mobile-admin.service');
      await mobileAdminService.initialize();
      logger.info('Mobile admin service initialized');
      
      logger.info('Initializing Jarvis services...');
      await ticketService.initialize();
      logger.info('Ticket service initialized');
      
      await projectService.initialize();
      logger.info('Project service initialized');
      
      await reminderService.initialize();
      logger.info('Reminder service initialized');
      
      await dailyReportService.initialize();
      logger.info('Daily report service initialized');
      
      logger.info('All Jarvis services initialized successfully!');
      
      whatsappService.on('message', async (message) => {
        await messageHandler.handleMessage(message);
      });

      whatsappService.on('ready', () => {
        logger.info('Bot is ready to receive messages!');
        logger.info('Send /help to see available commands');
        
        // Reminder checker is started automatically during initialization
      });

      whatsappService.on('disconnected', (reason) => {
        logger.error('Bot disconnected:', reason);
        process.exit(1);
      });

      whatsappService.on('auth_failure', (message) => {
        logger.error('Authentication failed:', message);
        process.exit(1);
      });

      await whatsappService.initialize();
      
      return;
      
    } catch (error) {
      retries++;
      logger.error(`Failed to start bot (attempt ${retries}/${maxRetries}):`, error);
      
      if (error instanceof Error && error.message.includes('Appwrite')) {
        logger.error('Appwrite connection is required. Please check your Appwrite configuration.');
        
        if (retries < maxRetries) {
          logger.info(`Retrying in ${retryDelay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } else {
        process.exit(1);
      }
    }
  }
  
  logger.error('Failed to start bot after maximum retries');
  process.exit(1);
}

// Graceful shutdown handling
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    // Give the bot 5 seconds to clean up
    const shutdownTimeout = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 5000);
    
    // Stop reminder checker
    reminderService.stopReminderChecker();
    
    // Stop scheduled message checker
    const { scheduledAdminMessageService } = await import('./services/scheduled-admin-message.service');
    scheduledAdminMessageService.stopScheduler();
    
    await whatsappService.disconnect();
    clearTimeout(shutdownTimeout);
    
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle multiple shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

startBot();