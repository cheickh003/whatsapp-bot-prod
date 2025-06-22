import { BackupData } from '../models/admin.model';
import { appwriteService } from './appwrite.service';
import { adminService } from './admin.service';
import { logger } from '../utils/logger';
import { Query } from 'node-appwrite';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AdminDataService {
  private readonly BACKUP_DIR = path.join(process.cwd(), 'backups');

  async createBackup(adminPhone: string): Promise<string> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.BACKUP_DIR, { recursive: true });
      
      // Collect all data
      const backupData: BackupData = {
        conversations: await this.getAllDocuments('conversations'),
        messages: await this.getAllDocuments('messages'),
        admins: await this.getAllDocuments('admins'),
        blacklist: await this.getAllDocuments('blacklist'),
        config: await this.getAllDocuments('bot_config'),
        timestamp: new Date().toISOString()
      };
      
      // Create backup file
      const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filepath = path.join(this.BACKUP_DIR, filename);
      
      await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));
      
      await adminService.logAudit(adminPhone, 'backup', filename, true);
      
      // Get file size
      const stats = await fs.stat(filepath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      return `✅ *Backup créé avec succès*
📁 Fichier: ${filename}
💾 Taille: ${sizeMB} MB
📊 Données:
• Conversations: ${backupData.conversations.length}
• Messages: ${backupData.messages.length}
• Admins: ${backupData.admins.length}
• Blacklist: ${backupData.blacklist.length}
• Config: ${backupData.config.length}`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'backup', '', false, error.message);
      logger.error('Backup error:', error);
      return '❌ Erreur lors de la création du backup';
    }
  }

  private async getAllDocuments(collection: string): Promise<any[]> {
    const documents: any[] = [];
    let offset = 0;
    const limit = 100;
    
    while (true) {
      const response = await appwriteService.listDocuments(collection, [], limit, offset);
      documents.push(...response.documents);
      
      if (response.documents.length < limit) break;
      offset += limit;
    }
    
    return documents;
  }

  async clearUserData(phoneNumber: string, adminPhone: string): Promise<string> {
    try {
      // Find conversation
      const conversations = await appwriteService.listDocuments(
        'conversations',
        [Query.equal('phoneNumber', phoneNumber)]
      );
      
      if (conversations.total === 0) {
        return '⚠️ Aucune conversation trouvée pour cet utilisateur';
      }
      
      const conversationId = conversations.documents[0].$id;
      
      // Delete messages
      const messages = await appwriteService.listDocuments(
        'messages',
        [Query.equal('conversationId', conversationId)],
        100
      );
      
      let deletedCount = 0;
      for (const message of messages.documents) {
        await appwriteService.deleteDocument('messages', message.$id);
        deletedCount++;
      }
      
      // Delete conversation
      await appwriteService.deleteDocument('conversations', conversationId);
      
      await adminService.logAudit(adminPhone, 'clear', phoneNumber, true);
      
      return `✅ *Données supprimées*
📱 Utilisateur: ${phoneNumber}
💬 Messages supprimés: ${deletedCount}
🗑️ Conversation supprimée`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'clear', phoneNumber, false, error.message);
      logger.error('Clear data error:', error);
      return '❌ Erreur lors de la suppression des données';
    }
  }

  async clearAllData(adminPhone: string): Promise<string> {
    try {
      // Confirm this is really what they want
      const stats = {
        conversations: 0,
        messages: 0
      };
      
      // Delete all messages
      const messages = await this.getAllDocuments('messages');
      for (const message of messages) {
        await appwriteService.deleteDocument('messages', message.$id);
        stats.messages++;
      }
      
      // Delete all conversations
      const conversations = await this.getAllDocuments('conversations');
      for (const conversation of conversations) {
        await appwriteService.deleteDocument('conversations', conversation.$id);
        stats.conversations++;
      }
      
      await adminService.logAudit(adminPhone, 'clear', 'all', true);
      
      // Notify all admins
      await adminService.notifyAdmins(
        `⚠️ TOUTES les données ont été supprimées par ${adminPhone}`,
        adminPhone
      );
      
      return `✅ *Toutes les données supprimées*
🗑️ Conversations: ${stats.conversations}
🗑️ Messages: ${stats.messages}

⚠️ Cette action est irréversible!`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'clear', 'all', false, error.message);
      logger.error('Clear all data error:', error);
      return '❌ Erreur lors de la suppression des données';
    }
  }

  async exportUserData(phoneNumber: string, adminPhone: string): Promise<string> {
    try {
      // Find conversation
      const conversations = await appwriteService.listDocuments(
        'conversations',
        [Query.equal('phoneNumber', phoneNumber)]
      );
      
      if (conversations.total === 0) {
        return '⚠️ Aucune conversation trouvée pour cet utilisateur';
      }
      
      const conversation = conversations.documents[0];
      const conversationId = conversation.$id;
      
      // Get all messages
      const messages = await appwriteService.listDocuments(
        'messages',
        [Query.equal('conversationId', conversationId)],
        1000
      );
      
      // Sort messages by timestamp
      messages.documents.sort((a: any, b: any) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Create export data
      const exportData = {
        user: {
          phoneNumber: conversation.phoneNumber,
          name: conversation.name || 'Unknown',
          firstMessage: conversation.createdAt,
          lastMessage: conversation.updatedAt
        },
        totalMessages: messages.total,
        messages: messages.documents.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }))
      };
      
      // Save to file
      await fs.mkdir(path.join(process.cwd(), 'exports'), { recursive: true });
      const filename = `export_${phoneNumber.replace('@c.us', '')}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filepath = path.join(process.cwd(), 'exports', filename);
      
      await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
      
      // Also create a readable text version
      const textFilename = filename.replace('.json', '.txt');
      const textFilepath = path.join(process.cwd(), 'exports', textFilename);
      
      let textContent = `Conversation Export - ${phoneNumber}\n`;
      textContent += `Name: ${exportData.user.name}\n`;
      textContent += `Period: ${exportData.user.firstMessage} to ${exportData.user.lastMessage}\n`;
      textContent += `Total Messages: ${exportData.totalMessages}\n`;
      textContent += '='.repeat(50) + '\n\n';
      
      exportData.messages.forEach((msg: any) => {
        const timestamp = new Date(msg.timestamp).toLocaleString();
        const role = msg.role === 'user' ? 'USER' : 'BOT';
        textContent += `[${timestamp}] ${role}:\n${msg.content}\n\n`;
      });
      
      await fs.writeFile(textFilepath, textContent);
      
      await adminService.logAudit(adminPhone, 'export', phoneNumber, true);
      
      return `✅ *Export réussi*
📱 Utilisateur: ${phoneNumber}
💬 Messages exportés: ${messages.total}
📁 Fichiers:
• JSON: ${filename}
• TXT: ${textFilename}
📂 Dossier: exports/`;
    } catch (error: any) {
      await adminService.logAudit(adminPhone, 'export', phoneNumber, false, error.message);
      logger.error('Export error:', error);
      return '❌ Erreur lors de l\'export des données';
    }
  }

  async listBackups(): Promise<string> {
    try {
      await fs.mkdir(this.BACKUP_DIR, { recursive: true });
      const files = await fs.readdir(this.BACKUP_DIR);
      const backupFiles = files.filter(f => f.startsWith('backup_') && f.endsWith('.json'));
      
      if (backupFiles.length === 0) {
        return '📁 *Aucun backup disponible*';
      }
      
      let response = '📁 *Backups Disponibles*\n━━━━━━━━━━━━━━\n\n';
      
      for (const file of backupFiles) {
        const filepath = path.join(this.BACKUP_DIR, file);
        const stats = await fs.stat(filepath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        const date = new Date(stats.mtime).toLocaleString();
        
        response += `📄 ${file}\n`;
        response += `   💾 ${sizeMB} MB\n`;
        response += `   📅 ${date}\n\n`;
      }
      
      return response;
    } catch (error: any) {
      logger.error('List backups error:', error);
      return '❌ Erreur lors de la liste des backups';
    }
  }
}

export const adminDataService = new AdminDataService();