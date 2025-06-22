import { SystemStatus } from '../models/admin.model';
import { adminService } from './admin.service';
import { appwriteService } from './appwrite.service';
import { aiService } from './ai.service';
import { whatsappService } from './whatsapp.service';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AdminMaintenanceService {
  private startTime: Date = new Date();
  
  async getSystemStatus(): Promise<SystemStatus> {
    const uptime = Date.now() - this.startTime.getTime();
    const memoryUsage = process.memoryUsage();
    
    // Get active users (messages in last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const messages = await appwriteService.listDocuments(
      'messages',
      [],
      100
    );
    
    const uniqueUsers = new Set(
      messages.documents
        .filter((msg: any) => msg.timestamp > yesterday)
        .map((msg: any) => msg.conversationId)
    );

    // Test connections
    const connections = {
      appwrite: await this.testAppwriteConnection(),
      openai: await this.testOpenAIConnection(),
      whatsapp: { status: whatsappService.isReady() }
    };

    return {
      uptime,
      memoryUsage: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      },
      activeUsers: uniqueUsers.size,
      messagesLast24h: messages.documents.filter((msg: any) => msg.timestamp > yesterday).length,
      connections,
      mode: adminService.getBotMode()
    };
  }

  private async testAppwriteConnection(): Promise<{ status: boolean; latency: number }> {
    const start = Date.now();
    try {
      await appwriteService.testConnection();
      return { status: true, latency: Date.now() - start };
    } catch {
      return { status: false, latency: -1 };
    }
  }

  private async testOpenAIConnection(): Promise<{ status: boolean; latency: number }> {
    const start = Date.now();
    try {
      // Simple test call
      await aiService.processMessage('test', 'ping', []);
      return { status: true, latency: Date.now() - start };
    } catch {
      return { status: false, latency: -1 };
    }
  }

  formatStatus(status: SystemStatus): string {
    const uptimeHours = Math.floor(status.uptime / (1000 * 60 * 60));
    const uptimeDays = Math.floor(uptimeHours / 24);
    const uptimeHoursRem = uptimeHours % 24;
    const uptimeMinutes = Math.floor((status.uptime % (1000 * 60 * 60)) / (1000 * 60));

    const appwriteStatus = status.connections.appwrite.status ? 
      `✅ OK (${status.connections.appwrite.latency}ms)` : '❌ DOWN';
    const openaiStatus = status.connections.openai.status ? 
      `✅ OK (${status.connections.openai.latency}ms)` : '❌ DOWN';
    const whatsappStatus = status.connections.whatsapp.status ? '✅ Connected' : '❌ Disconnected';

    return `📊 *Status du Bot*
━━━━━━━━━━━━━━
⏱️ Uptime: ${uptimeDays}j ${uptimeHoursRem}h ${uptimeMinutes}m
💾 RAM: ${status.memoryUsage.used}MB/${status.memoryUsage.total}MB (${status.memoryUsage.percentage}%)
👥 Users actifs: ${status.activeUsers}
📨 Messages/24h: ${status.messagesLast24h}
🔧 Mode: ${status.mode.toUpperCase()}

*Connexions:*
• Appwrite: ${appwriteStatus}
• OpenAI: ${openaiStatus}
• WhatsApp: ${whatsappStatus}`;
  }

  async restart(adminPhone: string): Promise<string> {
    try {
      await adminService.logAudit(adminPhone, 'restart', '', true);
      
      // Notify other admins
      await adminService.notifyAdmins(
        `🔄 Bot redémarré par ${adminPhone}`,
        adminPhone
      );
      
      // Schedule restart
      setTimeout(() => {
        logger.info('Restarting bot as requested by admin');
        process.exit(0); // PM2 or systemd will restart
      }, 2000);
      
      return '🔄 Redémarrage du bot dans 2 secondes...';
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'restart', '', false, error.message);
      return '❌ Erreur lors du redémarrage';
    }
  }

  async getLogs(lines: number = 50): Promise<string> {
    try {
      const logPath = path.join(process.cwd(), 'bot.log');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const logLines = logContent.split('\n').filter(line => line.trim());
      const lastLines = logLines.slice(-lines);
      
      // Format for WhatsApp (truncate long lines)
      const formatted = lastLines
        .map(line => {
          // Remove ANSI color codes
          const clean = line.replace(/\u001b\[[0-9;]*m/g, '');
          // Extract log level and message
          const match = clean.match(/(\w+):\s*(.*?)\s*{"timestamp"/);
          if (match) {
            const [, level, message] = match;
            const icon = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
            return `${icon} ${message ? message.substring(0, 60) : ''}${message && message.length > 60 ? '...' : ''}`;
          }
          return clean.substring(0, 70) + (clean.length > 70 ? '...' : '');
        })
        .join('\n');
      
      return `📜 *Derniers ${lines} logs:*\n\`\`\`\n${formatted}\n\`\`\``;
    } catch (error: any) {
      logger.error('Error reading logs:', error);
      return '❌ Erreur lors de la lecture des logs';
    }
  }

  setStartTime(time: Date): void {
    this.startTime = time;
  }
}

export const adminMaintenanceService = new AdminMaintenanceService();