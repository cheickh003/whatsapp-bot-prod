import { BotMode } from '../models/admin.model';
import { adminService } from './admin.service';
import { logger } from '../utils/logger';
import { messageHandler } from '../handlers/message.handler';

export class AdminConfigService {
  private readonly ALLOWED_CONFIG_KEYS = [
    'typing_delay',
    'max_history_length',
    'ai_model',
    'ai_temperature',
    'ai_max_tokens',
    'welcome_message',
    'error_message',
    'maintenance_message',
    'bot_name',
    'bot_personality'
  ];

  async showConfig(): Promise<string> {
    try {
      let response = '⚙️ *Configuration du Bot*\n━━━━━━━━━━━━━━\n\n';
      
      // Bot mode
      response += `🔧 Mode: ${adminService.getBotMode().toUpperCase()}\n\n`;
      
      // Environment variables (masked)
      response += '*Variables d\'environnement:*\n';
      response += `• OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '****' + process.env.OPENAI_API_KEY.slice(-4) : 'NON DÉFINI'}\n\n`;
      
      // Dynamic configs
      response += '*Configuration dynamique:*\n';
      for (const key of this.ALLOWED_CONFIG_KEYS) {
        const value = await adminService.getConfig(key);
        if (value) {
          response += `• ${key}: ${value}\n`;
        }
      }
      
      // Current settings
      response += '\n*Paramètres actuels:*\n';
      response += `• Typing delay: ${messageHandler.getTypingDelay()}ms\n`;
      response += `• Message history limit: 20\n`;
      response += `• AI Model: gpt-4.0-mini\n`;
      
      return response;
    } catch (error: any) {
      logger.error('Show config error:', error);
      return '❌ Erreur lors de l\'affichage de la configuration';
    }
  }

  async setConfig(key: string, value: string, adminPhone: string): Promise<string> {
    try {
      // Validate key
      if (!this.ALLOWED_CONFIG_KEYS.includes(key)) {
        return `❌ Clé non autorisée. Clés valides:\n${this.ALLOWED_CONFIG_KEYS.join('\n')}`;
      }
      
      // Apply specific configs immediately
      switch (key) {
        case 'typing_delay':
          const delay = parseInt(value);
          if (isNaN(delay) || delay < 0 || delay > 10000) {
            return '❌ Le délai doit être entre 0 et 10000 ms';
          }
          messageHandler.setTypingDelay(delay);
          break;
      }
      
      // Save to database
      await adminService.setConfig(key, value, adminPhone);
      await adminService.logAudit(adminPhone, 'config set', `${key}=${value}`, true);
      
      // Notify other admins
      await adminService.notifyAdmins(
        `⚙️ Config modifiée par ${adminPhone}\n${key} = ${value}`,
        adminPhone
      );
      
      return `✅ Configuration mise à jour\n${key} = ${value}`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'config set', `${key}=${value}`, false, error.message);
      logger.error('Set config error:', error);
      return '❌ Erreur lors de la mise à jour de la configuration';
    }
  }

  async setMode(mode: string, adminPhone: string): Promise<string> {
    try {
      const botMode = mode.toLowerCase() as BotMode;
      
      if (!Object.values(BotMode).includes(botMode)) {
        return '❌ Mode invalide. Modes valides: normal, maintenance, readonly';
      }
      
      await adminService.setBotMode(botMode, adminPhone);
      await adminService.logAudit(adminPhone, 'mode', mode, true);
      
      // Notify all admins
      await adminService.notifyAdmins(
        `🔧 Mode changé en ${botMode.toUpperCase()} par ${adminPhone}`,
        adminPhone
      );
      
      let response = `✅ Mode changé en: ${botMode.toUpperCase()}\n\n`;
      
      switch (botMode) {
        case BotMode.MAINTENANCE:
          response += '⚠️ Seuls les admins peuvent utiliser le bot';
          break;
        case BotMode.READONLY:
          response += '👁️ Le bot répond mais ne sauvegarde pas les messages';
          break;
        case BotMode.NORMAL:
          response += '✅ Le bot fonctionne normalement';
          break;
      }
      
      return response;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'mode', mode, false, error.message);
      logger.error('Set mode error:', error);
      return '❌ Erreur lors du changement de mode';
    }
  }

  async reloadConfig(adminPhone: string): Promise<string> {
    try {
      // Reload specific configs
      const typingDelay = await adminService.getConfig('typing_delay');
      if (typingDelay) {
        messageHandler.setTypingDelay(parseInt(typingDelay));
      }
      
      await adminService.logAudit(adminPhone, 'reload', '', true);
      
      return '✅ Configuration rechargée avec succès';
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'reload', '', false, error.message);
      logger.error('Reload config error:', error);
      return '❌ Erreur lors du rechargement de la configuration';
    }
  }

  async getConfigHelp(): Promise<string> {
    return `⚙️ *Aide Configuration*
━━━━━━━━━━━━━━

*Clés de configuration disponibles:*

• *typing_delay* - Délai de frappe (ms)
  Exemple: /admin config set typing_delay 2000

• *max_history_length* - Nombre max de messages dans l'historique
  Exemple: /admin config set max_history_length 30

• *ai_temperature* - Créativité de l'IA (0.0-1.0)
  Exemple: /admin config set ai_temperature 0.7

• *welcome_message* - Message de bienvenue
• *error_message* - Message d'erreur
• *maintenance_message* - Message en mode maintenance
• *bot_name* - Nom du bot
• *bot_personality* - Personnalité du bot

*Modes disponibles:*
• *normal* - Fonctionnement normal
• *maintenance* - Admins seulement
• *readonly* - Lecture seule`;
  }
}

export const adminConfigService = new AdminConfigService();