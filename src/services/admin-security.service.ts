import { appwriteService } from './appwrite.service';
import { adminService } from './admin.service';
import { whatsappService } from './whatsapp.service';
import { logger } from '../utils/logger';
import { Query, ID } from 'node-appwrite';
import * as crypto from 'crypto';

export class AdminSecurityService {
  private debugMode: Map<string, boolean> = new Map();
  
  async addAdmin(phoneNumber: string, name: string, pin: string, adminPhone: string): Promise<string> {
    try {
      // Check if already admin
      const existing = await appwriteService.listDocuments(
        'admins',
        [Query.equal('phoneNumber', phoneNumber)]
      );
      
      if (existing.total > 0) {
        return '⚠️ Cet utilisateur est déjà admin';
      }
      
      // Hash PIN
      const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
      
      // Create admin
      await appwriteService.createDocument('admins', ID.unique(), {
        phoneNumber,
        pin: hashedPin,
        name,
        createdAt: new Date().toISOString()
      });
      
      await adminService.logAudit(adminPhone, 'auth add', phoneNumber, true);
      
      // Notify all admins
      await adminService.notifyAdmins(
        `👤 Nouvel admin ajouté par ${adminPhone}\n📱 ${phoneNumber}\n👤 ${name}`,
        adminPhone
      );
      
      return `✅ Admin ajouté avec succès\n📱 ${phoneNumber}\n👤 ${name}\n🔐 PIN: ${pin}\n\n⚠️ Communiquez le PIN de manière sécurisée!`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'auth add', phoneNumber, false, error.message);
      logger.error('Add admin error:', error);
      return '❌ Erreur lors de l\'ajout de l\'admin';
    }
  }

  async removeAdmin(phoneNumber: string, adminPhone: string): Promise<string> {
    try {
      // Prevent self-removal
      if (phoneNumber === adminPhone) {
        return '❌ Vous ne pouvez pas vous retirer vous-même';
      }
      
      // Check if exists
      const admins = await appwriteService.listDocuments(
        'admins',
        [Query.equal('phoneNumber', phoneNumber)]
      );
      
      if (admins.total === 0) {
        return '⚠️ Cet utilisateur n\'est pas admin';
      }
      
      // Check if last admin
      const allAdmins = await appwriteService.listDocuments('admins');
      if (allAdmins.total <= 1) {
        return '❌ Impossible de supprimer le dernier admin';
      }
      
      // Remove admin
      await appwriteService.deleteDocument('admins', admins.documents[0].$id);
      
      await adminService.logAudit(adminPhone, 'auth remove', phoneNumber, true);
      
      // Notify all admins
      await adminService.notifyAdmins(
        `👤 Admin retiré par ${adminPhone}\n📱 ${phoneNumber}`,
        adminPhone
      );
      
      return `✅ Admin ${phoneNumber} retiré avec succès`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'auth remove', phoneNumber, false, error.message);
      logger.error('Remove admin error:', error);
      return '❌ Erreur lors de la suppression de l\'admin';
    }
  }

  async listAdmins(): Promise<string> {
    try {
      const admins = await appwriteService.listDocuments('admins');
      
      let response = '👥 *Liste des Admins*\n━━━━━━━━━━━━━━\n\n';
      
      admins.documents.forEach((admin: any, index: number) => {
        const createdDate = new Date(admin.createdAt).toLocaleDateString();
        const lastAuth = admin.lastAuth ? new Date(admin.lastAuth).toLocaleString() : 'Jamais';
        
        response += `${index + 1}. 📱 ${admin.phoneNumber}\n`;
        response += `   👤 ${admin.name}\n`;
        response += `   📅 Ajouté le: ${createdDate}\n`;
        response += `   🔐 Dernière auth: ${lastAuth}\n\n`;
      });
      
      return response;
    } catch (error: any) {
      logger.error('List admins error:', error);
      return '❌ Erreur lors de la liste des admins';
    }
  }

  async broadcast(message: string, adminPhone: string): Promise<string> {
    try {
      // Get all active users
      const conversations = await appwriteService.listDocuments('conversations');
      const recipients: string[] = [];
      
      for (const conv of conversations.documents) {
        // Skip if blacklisted
        if (await adminService.isBlacklisted(conv.phoneNumber)) {
          continue;
        }
        
        recipients.push(conv.phoneNumber);
      }
      
      await adminService.logAudit(adminPhone, 'broadcast', `${recipients.length} users`, true);
      
      // Send broadcast
      let sent = 0;
      let failed = 0;
      
      const broadcastMessage = `📢 *Message de l'administrateur*\n━━━━━━━━━━━━━━\n\n${message}\n\n_Envoyé par l'équipe du bot_`;
      
      for (const recipient of recipients) {
        try {
          await whatsappService.sendMessage(recipient, broadcastMessage);
          sent++;
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
          failed++;
          logger.error(`Broadcast failed for ${recipient}:`, error);
        }
      }
      
      // Notify admins
      await adminService.notifyAdmins(
        `📢 Broadcast envoyé par ${adminPhone}\n✅ Réussi: ${sent}\n❌ Échoué: ${failed}`,
        adminPhone
      );
      
      return `📢 *Broadcast envoyé*\n━━━━━━━━━━━━━━\n✅ Envoyé à: ${sent} utilisateurs\n❌ Échec: ${failed} utilisateurs\n\nMessage:\n"${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'broadcast', '', false, error.message);
      logger.error('Broadcast error:', error);
      return '❌ Erreur lors du broadcast';
    }
  }

  async emergency(adminPhone: string): Promise<string> {
    try {
      logger.warn('EMERGENCY SHUTDOWN INITIATED BY ' + adminPhone);
      
      // Save current state
      await adminService.logAudit(adminPhone, 'emergency', '', true);
      
      // Set maintenance mode
      await adminService.setBotMode('maintenance' as any, adminPhone);
      
      // Notify all admins
      const adminsToNotify = await adminService.notifyAdmins(
        `🚨 ARRÊT D'URGENCE par ${adminPhone}\nLe bot est maintenant en mode maintenance`,
        adminPhone
      );
      
      // Give time for notifications
      setTimeout(() => {
        logger.error('Emergency shutdown completed');
        process.exit(1);
      }, 2000);
      
      return `🚨 *ARRÊT D'URGENCE ACTIVÉ*\n━━━━━━━━━━━━━━\n\n✅ Mode maintenance activé\n✅ État sauvegardé\n✅ ${adminsToNotify.length} admins notifiés\n\n⏱️ Arrêt dans 2 secondes...`;
    } catch (error: any) {
      logger.error('Emergency shutdown error:', error);
      // Force exit anyway
      process.exit(1);
    }
  }

  async enableDebug(phoneNumber: string, adminPhone: string): Promise<string> {
    try {
      this.debugMode.set(phoneNumber, true);
      
      await adminService.logAudit(adminPhone, 'debug', phoneNumber, true);
      
      // Set a timeout to auto-disable after 30 minutes
      setTimeout(() => {
        this.debugMode.delete(phoneNumber);
        logger.info(`Debug mode auto-disabled for ${phoneNumber}`);
      }, 30 * 60 * 1000);
      
      return `🐛 Mode debug activé pour ${phoneNumber}\n⏱️ Durée: 30 minutes\n\nLes logs détaillés seront visibles dans bot.log`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'debug', phoneNumber, false, error.message);
      return '❌ Erreur lors de l\'activation du mode debug';
    }
  }

  isDebugEnabled(phoneNumber: string): boolean {
    return this.debugMode.get(phoneNumber) || false;
  }

  async testFeature(feature: string, adminPhone: string): Promise<string> {
    try {
      let result = '';
      
      switch (feature.toLowerCase()) {
        case 'whatsapp':
          result = whatsappService.isReady() ? 
            '✅ WhatsApp connecté et prêt' : 
            '❌ WhatsApp non connecté';
          break;
          
        case 'appwrite':
          const appwriteOk = await appwriteService.testConnection();
          result = appwriteOk ? 
            '✅ Appwrite connecté' : 
            '❌ Appwrite non accessible';
          break;
          
        case 'ai':
          try {
            const testResponse = await fetch('https://api.openai.com/v1/models', {
              headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
              }
            });
            result = testResponse.ok ? 
              '✅ OpenAI API accessible' : 
              '❌ OpenAI API inaccessible';
          } catch {
            result = '❌ Erreur de connexion OpenAI';
          }
          break;
          
        case 'memory':
          const testPhone = 'test@c.us';
          const conv = await appwriteService.getOrCreateConversation(testPhone);
          result = conv ? 
            '✅ Système de mémoire fonctionnel' : 
            '❌ Erreur système de mémoire';
          break;
          
        default:
          result = `❌ Feature inconnue: ${feature}\n\nFeatures disponibles:\n• whatsapp\n• appwrite\n• ai\n• memory`;
      }
      
      await adminService.logAudit(adminPhone, 'test', feature, true);
      
      return `🧪 *Test: ${feature}*\n━━━━━━━━━━━━━━\n\n${result}`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'test', feature, false, error.message);
      logger.error('Test feature error:', error);
      return '❌ Erreur lors du test';
    }
  }

  async changePin(oldPin: string, newPin: string, adminPhone: string): Promise<string> {
    try {
      // Verify old PIN
      const authenticated = await adminService.authenticate(adminPhone, oldPin);
      if (!authenticated) {
        return '❌ PIN actuel incorrect';
      }
      
      // Get admin record
      const admins = await appwriteService.listDocuments(
        'admins',
        [Query.equal('phoneNumber', adminPhone)]
      );
      
      if (admins.total === 0) {
        return '❌ Admin non trouvé';
      }
      
      // Update PIN
      const hashedNewPin = crypto.createHash('sha256').update(newPin).digest('hex');
      await appwriteService.updateDocument(
        'admins',
        admins.documents[0].$id,
        { pin: hashedNewPin }
      );
      
      await adminService.logAudit(adminPhone, 'changepin', '', true);
      
      return '✅ PIN changé avec succès\n\n⚠️ N\'oubliez pas votre nouveau PIN!';
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'changepin', '', false, error.message);
      logger.error('Change PIN error:', error);
      return '❌ Erreur lors du changement de PIN';
    }
  }
}

export const adminSecurityService = new AdminSecurityService();