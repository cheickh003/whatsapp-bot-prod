import { UserStats, BlacklistEntry, UserLimit } from '../models/admin.model';
import { appwriteService } from './appwrite.service';
import { adminService } from './admin.service';
import { logger } from '../utils/logger';
import { Query, ID } from 'node-appwrite';

export class AdminUsersService {
  async getActiveUsers(limit: number = 20): Promise<UserStats[]> {
    try {
      // Get all conversations
      const conversations = await appwriteService.listDocuments('conversations', [], limit);
      const userStats: UserStats[] = [];
      
      for (const conv of conversations.documents) {
        // Get message count for this conversation
        const messages = await appwriteService.listDocuments(
          'messages',
          [Query.equal('conversationId', conv.$id)],
          100
        );
        
        // Calculate tokens (rough estimate: 1 token per 4 chars)
        let totalTokens = 0;
        messages.documents.forEach((msg: any) => {
          totalTokens += Math.ceil(msg.content.length / 4);
        });
        
        // Estimate cost (GPT-4.0-mini: $0.01 per 1K tokens)
        const estimatedCost = (totalTokens / 1000) * 0.01;
        
        userStats.push({
          phoneNumber: conv.phoneNumber,
          name: conv.name || 'Unknown',
          totalMessages: messages.total,
          lastActivity: conv.updatedAt,
          tokensUsed: totalTokens,
          estimatedCost
        });
      }
      
      // Sort by last activity
      userStats.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
      
      return userStats;
    } catch (error: any) {
      logger.error('Error getting active users:', error);
      return [];
    }
  }

  formatUsersList(users: UserStats[]): string {
    if (users.length === 0) {
      return '📊 *Aucun utilisateur actif*';
    }

    let response = '👥 *Utilisateurs Actifs*\n━━━━━━━━━━━━━━\n\n';
    
    users.forEach((user, index) => {
      const lastActive = new Date(user.lastActivity);
      const daysAgo = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
      const activity = daysAgo === 0 ? "Aujourd'hui" : 
                      daysAgo === 1 ? "Hier" : 
                      `Il y a ${daysAgo} jours`;
      
      response += `${index + 1}. 📱 ${user.phoneNumber}\n`;
      response += `   👤 ${user.name}\n`;
      response += `   💬 ${user.totalMessages} messages\n`;
      response += `   🕐 ${activity}\n`;
      response += `   💰 ~$${user.estimatedCost.toFixed(2)}\n\n`;
    });
    
    return response;
  }

  async blockUser(phoneNumber: string, reason: string, adminPhone: string): Promise<string> {
    try {
      // Check if already blocked
      const existing = await appwriteService.listDocuments(
        'blacklist',
        [Query.equal('phoneNumber', phoneNumber)]
      );
      
      if (existing.total > 0) {
        return '⚠️ Cet utilisateur est déjà bloqué';
      }
      
      // Add to blacklist
      await appwriteService.createDocument('blacklist', ID.unique(), {
        phoneNumber,
        reason,
        blockedAt: new Date().toISOString(),
        blockedBy: adminPhone
      });
      
      await adminService.logAudit(adminPhone, 'block', phoneNumber, true);
      
      // Notify other admins
      await adminService.notifyAdmins(
        `🚫 ${phoneNumber} bloqué par ${adminPhone}\nRaison: ${reason}`,
        adminPhone
      );
      
      return `✅ Utilisateur ${phoneNumber} bloqué avec succès`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'block', phoneNumber, false, error.message);
      return '❌ Erreur lors du blocage de l\'utilisateur';
    }
  }

  async unblockUser(phoneNumber: string, adminPhone: string): Promise<string> {
    try {
      const blacklist = await appwriteService.listDocuments(
        'blacklist',
        [Query.equal('phoneNumber', phoneNumber)]
      );
      
      if (blacklist.total === 0) {
        return '⚠️ Cet utilisateur n\'est pas bloqué';
      }
      
      // Remove from blacklist
      await appwriteService.deleteDocument('blacklist', blacklist.documents[0].$id);
      
      await adminService.logAudit(adminPhone, 'unblock', phoneNumber, true);
      
      // Notify other admins
      await adminService.notifyAdmins(
        `✅ ${phoneNumber} débloqué par ${adminPhone}`,
        adminPhone
      );
      
      return `✅ Utilisateur ${phoneNumber} débloqué avec succès`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'unblock', phoneNumber, false, error.message);
      return '❌ Erreur lors du déblocage de l\'utilisateur';
    }
  }

  async setUserLimit(phoneNumber: string, dailyLimit: number, adminPhone: string): Promise<string> {
    try {
      const existing = await appwriteService.listDocuments(
        'user_limits',
        [Query.equal('phoneNumber', phoneNumber)]
      );
      
      const limitData = {
        phoneNumber,
        dailyLimit,
        messagesUsed: 0,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      if (existing.total > 0) {
        await appwriteService.updateDocument(
          'user_limits',
          existing.documents[0].$id,
          limitData
        );
      } else {
        await appwriteService.createDocument('user_limits', ID.unique(), limitData);
      }
      
      await adminService.logAudit(adminPhone, 'limit', `${phoneNumber} ${dailyLimit}`, true);
      
      return `✅ Limite de ${dailyLimit} messages/jour définie pour ${phoneNumber}`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'limit', `${phoneNumber} ${dailyLimit}`, false, error.message);
      return '❌ Erreur lors de la définition de la limite';
    }
  }

  async getBlacklist(): Promise<string> {
    try {
      const blacklist = await appwriteService.listDocuments('blacklist', [], 50);
      
      if (blacklist.total === 0) {
        return '✅ *Aucun utilisateur bloqué*';
      }
      
      let response = '🚫 *Liste Noire*\n━━━━━━━━━━━━━━\n\n';
      
      blacklist.documents.forEach((entry: BlacklistEntry, index: number) => {
        const blockedDate = new Date(entry.blockedAt).toLocaleDateString();
        response += `${index + 1}. 📱 ${entry.phoneNumber}\n`;
        response += `   📅 Bloqué le: ${blockedDate}\n`;
        response += `   👤 Par: ${entry.blockedBy}\n`;
        response += `   📝 Raison: ${entry.reason}\n\n`;
      });
      
      return response;
    } catch (error: any) {
      logger.error('Error getting blacklist:', error);
      return '❌ Erreur lors de la récupération de la liste noire';
    }
  }

  async getUserLimits(): Promise<string> {
    try {
      const limits = await appwriteService.listDocuments('user_limits', [], 50);
      
      if (limits.total === 0) {
        return '✅ *Aucune limite définie*';
      }
      
      let response = '⚡ *Limites Utilisateurs*\n━━━━━━━━━━━━━━\n\n';
      
      limits.documents.forEach((limit: UserLimit, index: number) => {
        const resetTime = new Date(limit.resetAt);
        const hoursLeft = Math.max(0, Math.floor((resetTime.getTime() - Date.now()) / (1000 * 60 * 60)));
        
        response += `${index + 1}. 📱 ${limit.phoneNumber}\n`;
        response += `   📊 ${limit.messagesUsed}/${limit.dailyLimit} messages\n`;
        response += `   ⏰ Reset dans ${hoursLeft}h\n\n`;
      });
      
      return response;
    } catch (error: any) {
      logger.error('Error getting user limits:', error);
      return '❌ Erreur lors de la récupération des limites';
    }
  }
}

export const adminUsersService = new AdminUsersService();