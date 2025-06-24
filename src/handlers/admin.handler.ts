import { adminService } from '../services/admin.service';
import { adminMaintenanceService } from '../services/admin-maintenance.service';
import { adminUsersService } from '../services/admin-users.service';
import { adminDataService } from '../services/admin-data.service';
import { adminConfigService } from '../services/admin-config.service';
import { adminMonitoringService } from '../services/admin-monitoring.service';
import { adminSecurityService } from '../services/admin-security.service';
import { adminMessagingService } from '../services/admin-messaging.service';
import { logger } from '../utils/logger';
import { dailyReportService } from '../services/daily-report.service';
import { scheduledMessageService } from '../services/scheduled-message.service';
import { createAbidjanDateTime, getCurrentAbidjanTime } from '../utils/date.utils';

export class AdminHandler {
  async handleAdminCommand(phoneNumber: string, command: string): Promise<string> {
    try {
      const parts = command.split(' ').filter(p => p);
      const adminCmd = parts[1]?.toLowerCase();
      
      // First check if user is admin
      const isAdmin = await adminService.isAdmin(phoneNumber);
      
      // Auth command is special - can be used by potential admins
      if (adminCmd === 'auth' && parts.length === 3) {
        const pin = parts[2];
        const success = await adminService.authenticate(phoneNumber, pin!);
        
        if (success) {
          return '✅ Authentification réussie!\n🔐 Session valide pour 15 minutes\n\nTapez /admin help pour voir les commandes';
        } else {
          return '❌ Authentification échouée';
        }
      }
      
      // All other commands require admin status
      if (!isAdmin) {
        return '❌ Accès refusé. Cette commande est réservée aux administrateurs.';
      }
      
      // Check authentication
      if (!adminService.isAuthenticated(phoneNumber)) {
        return '🔐 Authentification requise\n\nUtilisez: /admin auth [PIN]';
      }
      
      // Route to appropriate handler
      switch (adminCmd) {
        case 'help':
          return this.getHelpText();
          
        // Maintenance commands
        case 'status':
          const status = await adminMaintenanceService.getSystemStatus();
          return adminMaintenanceService.formatStatus(status);
          
        case 'restart':
          return await adminMaintenanceService.restart(phoneNumber);
          
        case 'logs':
          const lines = parts[2] ? parseInt(parts[2]) : 50;
          return await adminMaintenanceService.getLogs(lines);
          
        // User management
        case 'users':
          const users = await adminUsersService.getActiveUsers();
          return adminUsersService.formatUsersList(users);
          
        case 'block':
          if (parts.length < 3) return '❌ Usage: /admin block [phone] [reason]';
          const blockPhone = parts[2]!;
          const blockReason = parts.slice(3).join(' ') || 'Admin decision';
          return await adminUsersService.blockUser(blockPhone, blockReason, phoneNumber);
          
        case 'unblock':
          if (parts.length < 3) return '❌ Usage: /admin unblock [phone]';
          return await adminUsersService.unblockUser(parts[2]!, phoneNumber);
          
        case 'limit':
          if (parts.length < 4) return '❌ Usage: /admin limit [phone] [messages/day]';
          const limitPhone = parts[2]!;
          const dailyLimit = parseInt(parts[3]!);
          if (isNaN(dailyLimit)) return '❌ La limite doit être un nombre';
          return await adminUsersService.setUserLimit(limitPhone, dailyLimit, phoneNumber);
          
        case 'blacklist':
          return await adminUsersService.getBlacklist();
          
        case 'limits':
          return await adminUsersService.getUserLimits();
          
        // Data management
        case 'backup':
          return await adminDataService.createBackup(phoneNumber);
          
        case 'clear':
          if (parts.length < 3) return '❌ Usage: /admin clear [phone|all]';
          const target = parts[2]!;
          if (target === 'all') {
            return await adminDataService.clearAllData(phoneNumber);
          } else {
            return await adminDataService.clearUserData(target, phoneNumber);
          }
          
        case 'export':
          if (parts.length < 3) return '❌ Usage: /admin export [phone]';
          return await adminDataService.exportUserData(parts[2]!, phoneNumber);
          
        case 'backups':
          return await adminDataService.listBackups();
          
        // Configuration
        case 'config':
          if (parts.length === 2 || parts[2] === 'show') {
            return await adminConfigService.showConfig();
          }
          if (parts[2] === 'help') {
            return await adminConfigService.getConfigHelp();
          }
          if (parts[2] === 'set' && parts.length >= 5) {
            const key = parts[3]!;
            const value = parts.slice(4).join(' ');
            return await adminConfigService.setConfig(key, value, phoneNumber);
          }
          return '❌ Usage: /admin config [show|help|set key value]';
          
        case 'mode':
          if (parts.length < 3) return '❌ Usage: /admin mode [normal|maintenance|readonly]';
          return await adminConfigService.setMode(parts[2]!, phoneNumber);
          
        case 'reload':
          return await adminConfigService.reloadConfig(phoneNumber);
          
        // Monitoring
        case 'stats':
          const period = parts[2] as 'daily' | 'weekly' | 'monthly' || 'daily';
          return await adminMonitoringService.getStats(period);
          
        case 'report':
          return await dailyReportService.generateReport();
          
        case 'costs':
          return await adminMonitoringService.getCosts();
          
        case 'health':
          return await adminMonitoringService.getHealth();
          
        case 'audit':
          const auditLimit = parts[2] ? parseInt(parts[2]) : 20;
          return await adminMonitoringService.getAuditLog(auditLimit);
          
        // Security
        case 'auth':
          if (parts[2] === 'add' && parts.length >= 6) {
            const newAdminPhone = parts[3]!;
            const newAdminName = parts[4]!;
            const newAdminPin = parts[5]!;
            return await adminSecurityService.addAdmin(newAdminPhone, newAdminName, newAdminPin, phoneNumber);
          }
          if (parts[2] === 'remove' && parts.length >= 4) {
            return await adminSecurityService.removeAdmin(parts[3]!, phoneNumber);
          }
          if (parts[2] === 'list') {
            return await adminSecurityService.listAdmins();
          }
          if (parts[2] === 'changepin' && parts.length >= 5) {
            const oldPin = parts[3]!;
            const newPin = parts[4]!;
            return await adminSecurityService.changePin(oldPin, newPin, phoneNumber);
          }
          return '❌ Usage: /admin auth [add phone name pin|remove phone|list|changepin oldpin newpin]';
          
        // Remove old broadcast implementation since we have new one
          
        case 'emergency':
          return await adminSecurityService.emergency(phoneNumber);
          
        case 'debug':
          if (parts.length < 3) return '❌ Usage: /admin debug [phone]';
          return await adminSecurityService.enableDebug(parts[2]!, phoneNumber);
          
        case 'test':
          if (parts.length < 3) return '❌ Usage: /admin test [feature]';
          return await adminSecurityService.testFeature(parts[2]!, phoneNumber);
          
        // Messaging commands
        case 'send':
          return await this.handleSendMessage(phoneNumber, parts, false, false);
        
        case 'send-ai':
          return await this.handleSendAIMessage(phoneNumber, parts);
          
        case 'send-raw':
          return await this.handleSendMessage(phoneNumber, parts, false, true);
          
        case 'broadcast':
          return await this.handleBroadcast(phoneNumber, parts);
          
        case 'schedule':
          return await this.handleScheduleMessage(phoneNumber, parts);
          
        case 'scheduled':
          return await this.handleScheduledMessages(phoneNumber, parts);
          
        default:
          return '❌ Commande admin inconnue. Tapez /admin help pour l\'aide.';
      }
    } catch (error) {
      logger.error('Admin command error:', error);
      return '❌ Erreur lors de l\'exécution de la commande admin';
    }
  }

  private getHelpText(): string {
    return `🔧 *Commandes Admin*
━━━━━━━━━━━━━━

*🔐 Authentification:*
/admin auth [PIN]

*🔨 Maintenance:*
/admin status - État du système
/admin restart - Redémarrer le bot
/admin logs [n] - Voir les logs

*👥 Utilisateurs:*
/admin users - Liste des utilisateurs
/admin block [phone] [reason] - Bloquer
/admin unblock [phone] - Débloquer
/admin limit [phone] [n] - Limiter messages/jour
/admin blacklist - Voir liste noire
/admin limits - Voir limites

*💾 Données:*
/admin backup - Créer backup
/admin clear [phone|all] - Effacer données
/admin export [phone] - Exporter conversation
/admin backups - Liste des backups

*⚙️ Configuration:*
/admin config show - Voir config
/admin config set [key] [value] - Modifier
/admin config help - Aide config
/admin mode [normal|maintenance|readonly]
/admin reload - Recharger config

*📊 Monitoring:*
/admin stats [daily|weekly|monthly]
/admin report - Rapport quotidien détaillé
/admin costs - Coûts estimés
/admin health - Check santé
/admin audit [n] - Journal d'audit

*🛡️ Sécurité:*
/admin auth add [phone] [name] [pin]
/admin auth remove [phone]
/admin auth list - Liste admins
/admin auth changepin [old] [new]
/admin emergency - Arrêt d'urgence
/admin debug [phone] - Mode debug
/admin test [feature] - Tester feature

*💬 Messagerie Admin:*
/admin send [phone] [message] - Message avec badge admin
/admin send-ai [phone] [HH:MM] [msg] - Programmé + IA, sans badge
/admin send-raw [phone] [message] - Sans badge, sans IA
/admin schedule [time] [phone] [msg] - Programmé avec badge
/admin broadcast all [message] - Diffusion à tous
/admin scheduled list - Messages programmés
/admin scheduled cancel [id] - Annuler

📌 Ex: /admin send-ai 2250703079410 12:07 Dis bonjour
→ L'IA reformulera en message naturel à 12:07

📱 Format numéro: +2250XXXXXXXXX ou 2250XXXXXXXXX

📌 Session expire après 15 minutes`;
  }

  private async handleSendMessage(
    adminPhone: string,
    parts: string[],
    processWithAI: boolean,
    isRaw: boolean
  ): Promise<string> {
    if (parts.length < 4) {
      return '❌ Usage: /admin send[-ai|-raw] [phone] [message]\n' +
             '📱 Format: +2250XXXXXXXXX ou 2250XXXXXXXXX';
    }

    const targetUser = parts[2]!;
    const message = parts.slice(3).join(' ');

    let result = null;
    try {
      result = await adminMessagingService.sendMessage(
        adminPhone,
        targetUser,
        message,
        {
          showAdminBadge: !isRaw,
          processWithAI,
          isSystemMessage: false
        }
      );
    } catch (error: any) {
      return `❌ Erreur: ${error.message}`;
    }

    if (result) {
      return `✅ Message envoyé à ${targetUser}\n` +
             `Mode: ${processWithAI ? 'IA' : isRaw ? 'Brut' : 'Normal'}`;
    } else {
      return '❌ Erreur lors de l\'envoi du message';
    }
  }

  private async handleBroadcast(
    adminPhone: string,
    parts: string[]
  ): Promise<string> {
    if (parts.length < 4) {
      return '❌ Usage: /admin broadcast [all|phone1,phone2] [message]';
    }

    const target = parts[2]!;
    const message = parts.slice(3).join(' ');

    let results;
    if (target === 'all') {
      results = await adminMessagingService.sendToAllUsers(
        adminPhone,
        message,
        { showAdminBadge: true }
      );
    } else {
      return '❌ Target doit être: all';
    }

    return `📡 *Broadcast terminé*\n` +
           `✅ Envoyés: ${results.sent}\n` +
           `❌ Échoués: ${results.failed}`;
  }

  private async handleScheduledMessages(
    adminPhone: string,
    parts: string[]
  ): Promise<string> {
    if (parts.length < 3) {
      return '❌ Usage: /admin scheduled [list|cancel id]';
    }

    const action = parts[2]!;

    if (action === 'list') {
      const messages = await adminMessagingService.getScheduledMessages(adminPhone);
      if (messages.length === 0) {
        return '📥 Aucun message programmé';
      }

      let response = '🕰️ *Messages programmés:*\n';
      messages.forEach(msg => {
        const date = new Date(msg.scheduledFor!).toLocaleString('fr-FR');
        response += `\n🆔 ${msg.id.substring(0, 8)}\n`;
        response += `👤 ${msg.toUser}\n`;
        response += `🗓️ ${date}\n`;
        response += `📝 ${msg.originalMessage.substring(0, 50)}...\n`;
      });
      return response;
    }

    if (action === 'cancel' && parts.length >= 4) {
      const messageId = parts[3]!;
      const success = await adminMessagingService.cancelScheduledMessage(adminPhone, messageId);
      return success ? '✅ Message programmé annulé' : '❌ Erreur lors de l\'annulation';
    }

    return '❌ Action invalide';
  }

  private async handleScheduleMessage(
    adminPhone: string,
    parts: string[]
  ): Promise<string> {
    if (parts.length < 5) {
      return '❌ Usage: /admin schedule [time] @user [message]\n' +
             'Ex: /admin schedule "in 30 minutes" @user Hello\n' +
             'Ex: /admin schedule "2024-12-25 14:00" @user Joyeux Noël!';
    }

    const timeStr = parts[2]!;
    const targetUser = parts[3]!;
    const message = parts.slice(4).join(' ');

    // Parse time using reminder service logic
    const scheduledTime = this.parseScheduleTime(timeStr);
    if (!scheduledTime) {
      return '❌ Format de temps invalide. Utilisez:\n' +
             '- "in X minutes/hours"\n' +
             '- "tomorrow at HH:MM"\n' +
             '- "YYYY-MM-DD HH:MM"';
    }

    const result = await adminMessagingService.sendMessage(
      adminPhone,
      targetUser,
      message,
      {
        showAdminBadge: true,
        processWithAI: false,
        scheduledFor: scheduledTime
      }
    );

    if (result) {
      const dateStr = scheduledTime.toLocaleString('fr-FR');
      return `✅ Message programmé pour ${dateStr}\n` +
             `📨 Destinataire: ${targetUser}\n` +
             `🆔 ID: ${result.id.substring(0, 8)}`;
    } else {
      return '❌ Erreur lors de la programmation du message';
    }
  }

  private parseScheduleTime(timeStr: string): Date | null {
    // Parse relative times like "in 30 minutes"
    const relativeMatch = timeStr.match(/in\s+(\d+)\s+(minute|hour|day)s?/i);
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
      }
      return date;
    }

    // Parse "tomorrow at HH:MM"
    const tomorrowMatch = timeStr.match(/tomorrow\s+at\s+(\d{1,2}):(\d{2})/i);
    if (tomorrowMatch && tomorrowMatch[1] && tomorrowMatch[2]) {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      date.setHours(parseInt(tomorrowMatch[1]));
      date.setMinutes(parseInt(tomorrowMatch[2]));
      date.setSeconds(0);
      return date;
    }

    // Try parsing as absolute date
    const parsed = new Date(timeStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  }

  private async handleSendAIMessage(
    adminPhone: string,
    parts: string[]
  ): Promise<string> {
    // Format: /admin send-ai [phone] [time] [message...]
    // Example: /admin send-ai 2250703079410 12:07 bonjour ca va
    
    if (parts.length < 5) {
      return '❌ Usage: /admin send-ai [phone] [HH:MM] [message]\n' +
             'Ex: /admin send-ai 2250703079410 12:07 bonjour ca va';
    }

    const targetPhone = parts[2]!;
    const timeStr = parts[3]!;
    const message = parts.slice(4).join(' ');

    // Validate time format HH:MM
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      return '❌ Format d\'heure invalide. Utilisez HH:MM (ex: 12:07)';
    }

    const hour = parseInt(timeMatch[1]!);
    const minute = parseInt(timeMatch[2]!);
    
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return '❌ Heure invalide. Utilisez un format 24h valide';
    }

    // Get current time in Abidjan
    const currentAbidjan = getCurrentAbidjanTime();
    const currentMinutes = currentAbidjan.hour * 60 + currentAbidjan.minute;
    const targetMinutes = hour * 60 + minute;
    
    // Determine if we should schedule for today or tomorrow
    let daysToAdd = 0;
    if (targetMinutes <= currentMinutes) {
      // Time has passed today, schedule for tomorrow
      daysToAdd = 1;
    }
    
    // Create the scheduled time in Abidjan timezone
    const scheduledTime = createAbidjanDateTime(hour, minute, daysToAdd);

    try {
      // Format phone number properly
      let formattedPhone = targetPhone;
      if (!formattedPhone.endsWith('@c.us')) {
        formattedPhone = `${formattedPhone}@c.us`;
      }

      // Use admin messaging service with AI processing and scheduling
      const result = await adminMessagingService.sendMessage(
        adminPhone,
        formattedPhone,
        message,
        {
          showAdminBadge: false,  // Pas de badge admin
          processWithAI: true,    // Traiter avec l'IA
          isSystemMessage: false,
          scheduledFor: scheduledTime
        }
      );

      if (result) {
        const dateStr = scheduledMessageService.formatScheduledTime(scheduledTime);
        return `✅ Message programmé avec succès!\n\n` +
               `📅 Date d'envoi: ${dateStr}\n` +
               `📱 Destinataire: ${targetPhone}\n` +
               `💬 Message original: ${message}\n` +
               `🤖 Traitement: IA activée\n` +
               `🆔 ID: ${result.id}\n\n` +
               `_Le message sera traité par l'IA et envoyé sans badge admin_`;
      } else {
        return `❌ Erreur lors de la programmation du message`;
      }
    } catch (error: any) {
      logger.error('Erreur lors de la programmation du message AI:', error);
      return `❌ Erreur: ${error.message || 'Erreur inconnue'}`;
    }
  }
}

export const adminHandler = new AdminHandler();