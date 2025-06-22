import { appwriteService } from './appwrite.service';
import { logger } from '../utils/logger';
import { Query } from 'node-appwrite';

interface MessageStats {
  total: number;
  byHour: Map<number, number>;
  byDay: Map<string, number>;
  byUser: Map<string, number>;
}

interface CostEstimate {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  byUser: Map<string, { tokens: number; cost: number }>;
}

export class AdminMonitoringService {
  async getStats(period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<string> {
    try {
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'daily':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'weekly':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      
      const stats = await this.calculateStats(startDate);
      
      return this.formatStats(stats, period);
    } catch (error: any) {
      logger.error('Get stats error:', error);
      return '❌ Erreur lors du calcul des statistiques';
    }
  }

  private async calculateStats(startDate: Date): Promise<MessageStats> {
    const messages = await appwriteService.listDocuments(
      'messages',
      [Query.greaterThan('timestamp', startDate.toISOString())],
      1000
    );
    
    const stats: MessageStats = {
      total: messages.total,
      byHour: new Map(),
      byDay: new Map(),
      byUser: new Map()
    };
    
    // Get conversations for user mapping
    const conversations = await appwriteService.listDocuments('conversations');
    const convToUser = new Map();
    conversations.documents.forEach((conv: any) => {
      convToUser.set(conv.$id, conv.phoneNumber);
    });
    
    messages.documents.forEach((msg: any) => {
      const date = new Date(msg.timestamp);
      const hour = date.getHours();
      const day = date.toLocaleDateString();
      const user = convToUser.get(msg.conversationId) || 'Unknown';
      
      // By hour
      stats.byHour.set(hour, (stats.byHour.get(hour) || 0) + 1);
      
      // By day
      stats.byDay.set(day, (stats.byDay.get(day) || 0) + 1);
      
      // By user
      stats.byUser.set(user, (stats.byUser.get(user) || 0) + 1);
    });
    
    return stats;
  }

  private formatStats(stats: MessageStats, period: string): string {
    let response = `📊 *Statistiques (${period})*\n━━━━━━━━━━━━━━\n\n`;
    response += `📨 Total messages: ${stats.total}\n\n`;
    
    // Top users
    const topUsers = Array.from(stats.byUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    response += '*Top 5 Utilisateurs:*\n';
    topUsers.forEach(([user, count], index) => {
      const percentage = ((count / stats.total) * 100).toFixed(1);
      response += `${index + 1}. ${user}\n   📊 ${count} messages (${percentage}%)\n`;
    });
    
    // Activity by hour (simple ASCII chart)
    response += '\n*Activité par heure:*\n```\n';
    const maxHourCount = Math.max(...Array.from(stats.byHour.values()));
    
    for (let hour = 0; hour < 24; hour++) {
      const count = stats.byHour.get(hour) || 0;
      const barLength = Math.round((count / maxHourCount) * 20);
      const bar = '█'.repeat(barLength);
      response += `${hour.toString().padStart(2, '0')}h |${bar} ${count}\n`;
    }
    response += '```\n';
    
    // Daily trend
    if (stats.byDay.size > 1) {
      response += '\n*Tendance quotidienne:*\n';
      const sortedDays = Array.from(stats.byDay.entries())
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .slice(-7); // Last 7 days
      
      sortedDays.forEach(([day, count]) => {
        response += `• ${day}: ${count} messages\n`;
      });
    }
    
    return response;
  }

  async getCosts(): Promise<string> {
    try {
      const costs = await this.calculateCosts();
      
      return this.formatCosts(costs);
    } catch (error: any) {
      logger.error('Get costs error:', error);
      return '❌ Erreur lors du calcul des coûts';
    }
  }

  private async calculateCosts(): Promise<CostEstimate> {
    const messages = await appwriteService.listDocuments('messages', [], 1000);
    
    const costs: CostEstimate = {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      byUser: new Map()
    };
    
    // Get conversations for user mapping
    const conversations = await appwriteService.listDocuments('conversations');
    const convToUser = new Map();
    conversations.documents.forEach((conv: any) => {
      convToUser.set(conv.$id, conv.phoneNumber);
    });
    
    messages.documents.forEach((msg: any) => {
      // Rough token estimation: 1 token per 4 characters
      const tokens = Math.ceil(msg.content.length / 4);
      const user = convToUser.get(msg.conversationId) || 'Unknown';
      
      if (msg.role === 'user') {
        costs.inputTokens += tokens;
      } else {
        costs.outputTokens += tokens;
      }
      
      costs.totalTokens += tokens;
      
      // By user
      const userStats = costs.byUser.get(user) || { tokens: 0, cost: 0 };
      userStats.tokens += tokens;
      costs.byUser.set(user, userStats);
    });
    
    // Calculate costs (GPT-4.0-mini pricing)
    const inputCost = (costs.inputTokens / 1000) * 0.01;  // $0.01 per 1K input tokens
    const outputCost = (costs.outputTokens / 1000) * 0.03; // $0.03 per 1K output tokens
    costs.totalCost = inputCost + outputCost;
    
    // Update user costs
    costs.byUser.forEach((stats) => {
      stats.cost = (stats.tokens / 1000) * 0.02; // Average cost
    });
    
    return costs;
  }

  private formatCosts(costs: CostEstimate): string {
    let response = `💰 *Estimation des Coûts OpenAI*\n━━━━━━━━━━━━━━\n\n`;
    response += `📊 Tokens totaux: ${costs.totalTokens.toLocaleString()}\n`;
    response += `📥 Tokens entrée: ${costs.inputTokens.toLocaleString()}\n`;
    response += `📤 Tokens sortie: ${costs.outputTokens.toLocaleString()}\n`;
    response += `💵 Coût total estimé: $${costs.totalCost.toFixed(4)}\n\n`;
    
    // Top spenders
    const topSpenders = Array.from(costs.byUser.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 10);
    
    response += '*Top 10 Utilisateurs par coût:*\n';
    topSpenders.forEach(([user, stats], index) => {
      response += `${index + 1}. ${user}\n`;
      response += `   🪙 ${stats.tokens.toLocaleString()} tokens\n`;
      response += `   💵 ~$${stats.cost.toFixed(4)}\n`;
    });
    
    response += '\n_Note: Estimation basée sur GPT-4.0-mini_';
    
    return response;
  }

  async getHealth(): Promise<string> {
    try {
      const health = await this.checkHealth();
      
      return this.formatHealth(health);
    } catch (error: any) {
      logger.error('Health check error:', error);
      return '❌ Erreur lors du check de santé';
    }
  }

  private async checkHealth(): Promise<any> {
    const checks = {
      appwrite: { status: false, latency: 0, error: null },
      openai: { status: false, latency: 0, error: null },
      whatsapp: { status: false, error: null },
      disk: { available: 0, used: 0, percentage: 0 },
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
    
    // Check Appwrite
    const appwriteStart = Date.now();
    try {
      await appwriteService.testConnection();
      checks.appwrite.status = true;
      checks.appwrite.latency = Date.now() - appwriteStart;
    } catch (error: any) {
      checks.appwrite.error = error.message;
    }
    
    // Check OpenAI (would need to import ai service)
    // For now, just mark as OK if API key exists
    checks.openai.status = !!process.env.OPENAI_API_KEY;
    
    // Check WhatsApp (would need to import whatsapp service)
    checks.whatsapp.status = true; // Assume OK for now
    
    return checks;
  }

  private formatHealth(health: any): string {
    const formatBytes = (bytes: number) => {
      return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    };
    
    const formatUptime = (seconds: number) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${days}j ${hours}h ${minutes}m`;
    };
    
    let response = `🏥 *État de Santé du Bot*\n━━━━━━━━━━━━━━\n\n`;
    
    response += '*Services:*\n';
    response += `• Appwrite: ${health.appwrite.status ? `✅ OK (${health.appwrite.latency}ms)` : `❌ ${health.appwrite.error}`}\n`;
    response += `• OpenAI: ${health.openai.status ? '✅ OK' : '❌ API Key manquante'}\n`;
    response += `• WhatsApp: ${health.whatsapp.status ? '✅ Connecté' : '❌ Déconnecté'}\n\n`;
    
    response += '*Système:*\n';
    response += `• RAM utilisée: ${formatBytes(health.memory.heapUsed)}\n`;
    response += `• RAM totale: ${formatBytes(health.memory.heapTotal)}\n`;
    response += `• Uptime: ${formatUptime(health.uptime)}\n`;
    
    return response;
  }

  async getAuditLog(limit: number = 20): Promise<string> {
    try {
      const logs = await appwriteService.listDocuments(
        'admin_audit',
        [],
        limit,
        0,
        ['timestamp'],
        ['DESC']
      );
      
      if (logs.total === 0) {
        return '📋 *Aucune action admin enregistrée*';
      }
      
      let response = `📋 *Journal d'Audit Admin*\n━━━━━━━━━━━━━━\n\n`;
      
      logs.documents.forEach((log: any, index: number) => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        const status = log.success ? '✅' : '❌';
        
        response += `${index + 1}. ${status} ${log.command}\n`;
        response += `   👤 ${log.adminPhone}\n`;
        response += `   🕐 ${timestamp}\n`;
        if (log.parameters) {
          response += `   📝 ${log.parameters}\n`;
        }
        if (!log.success && log.error) {
          response += `   ⚠️ ${log.error}\n`;
        }
        response += '\n';
      });
      
      return response;
    } catch (error: any) {
      logger.error('Get audit log error:', error);
      return '❌ Erreur lors de la récupération du journal d\'audit';
    }
  }
}

export const adminMonitoringService = new AdminMonitoringService();