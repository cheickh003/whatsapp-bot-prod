import { CommandHandler, ChatContext } from '../types';
import { memoryService } from '../services/memory.service';
import { logger } from '../utils/logger';
import { adminHandler } from './admin.handler';
import { ticketService } from '../services/ticket.service';
import { projectService } from '../services/project.service';
// import { reminderService } from '../services/reminder.service';
import { reminderServiceV2 as reminderService } from '../services/reminder-service-v2';
import { documentService } from '../services/document.service';
import { simpleDocumentQAService } from '../services/simple-document-qa.service';
import { formatTime, isWithinBusinessHours } from '../utils/date.utils';

const commands: CommandHandler[] = [
  {
    command: 'help',
    description: 'Afficher les commandes disponibles / Show available commands',
    execute: async (): Promise<string> => {
      const now = new Date();
      const timeStr = formatTime(now);
      const inBusinessHours = isWithinBusinessHours(now);
      const statusEmoji = inBusinessHours ? '🟢' : '🔴';
      const statusText = inBusinessHours ? 'Heures ouvrables' : 'Hors heures ouvrables';
      
      return `🤖 *Jarvis - Assistant Nourx*\n` +
             `━━━━━━━━━━━━━━\n` +
             `🕐 Heure Abidjan: ${timeStr}\n` +
             `${statusEmoji} ${statusText}\n\n` +
             `📋 *Commandes disponibles:*\n\n` +
             `/help - Afficher cette aide\n` +
             `/ticket [description] - Créer un ticket support\n` +
             `/tickets - Voir vos tickets\n` +
             `/project [nom] - Créer un projet\n` +
             `/projects - Voir vos projets\n` +
             `/remind [temps] [message] - Créer un rappel\n` +
             `/reminders - Voir vos rappels\n` +
             `/doc - Gérer vos documents\n` +
             `/human - Demander assistance humaine\n` +
             `/clear - Effacer l'historique\n` +
             `/info - Informations conversation\n\n` +
             `💡 *Exemple:* /ticket J'ai besoin d'aide avec mon chatbot`;
    },
  },
  {
    command: 'clear',
    description: 'Effacer l\'historique / Clear conversation history',
    execute: async (_message: string, context: ChatContext): Promise<string> => {
      try {
        await memoryService.clearConversation(context.phoneNumber);
        return '🧹 *Historique effacé*\n\n' +
               'Notre conversation a été réinitialisée.\n' +
               'Je suis prêt pour un nouveau départ!';
      } catch (error) {
        logger.error('Error clearing conversation:', error);
        return '❌ Erreur lors de l\'effacement de l\'historique.';
      }
    },
  },
  {
    command: 'info',
    description: 'Informations conversation / Show conversation info',
    execute: async (_message: string, context: ChatContext): Promise<string> => {
      const messageCount = context.messageHistory.length;
      const maxHistory = memoryService.getMaxHistoryLength();
      
      return `ℹ️ *Informations de conversation*\n` +
        `━━━━━━━━━━━━━━\n` +
        `📱 Téléphone: ${context.phoneNumber}\n` +
        `💬 Messages en mémoire: ${messageCount}/${maxHistory}\n` +
        `🆔 ID conversation: ${context.conversationId}\n\n` +
        `_Je suis Jarvis, votre assistant Nourx_`;
    },
  },
  {
    command: 'ticket',
    description: 'Créer un ticket support / Create a support ticket',
    execute: async (message: string, context: ChatContext): Promise<string> => {
      try {
        const parts = message.split(' ');
        const description = parts.slice(1).join(' ');
        
        if (!description) {
          return '❌ Veuillez décrire votre problème.\n\n' +
                 '💡 Exemple: /ticket Mon chatbot ne répond plus';
        }

        const ticket = await ticketService.createTicket(
          context.phoneNumber,
          'Support Request',
          description
        );

        return ticketService.formatTicketForWhatsApp(ticket) + '\n\n' +
               '✅ Votre demande a été enregistrée.\n' +
               '📱 Un membre de l\'équipe vous contactera bientôt.';
      } catch (error) {
        logger.error('Error creating ticket:', error);
        return '❌ Erreur lors de la création du ticket. Veuillez réessayer.';
      }
    },
  },
  {
    command: 'tickets',
    description: 'Voir vos tickets / List your tickets',
    execute: async (_message: string, context: ChatContext): Promise<string> => {
      try {
        const tickets = await ticketService.getUserTickets(context.phoneNumber);
        
        if (tickets.length === 0) {
          return '📭 Vous n\'avez aucun ticket.';
        }

        let response = '📋 *Vos tickets récents:*\n━━━━━━━━━━━━━━\n\n';
        
        for (const ticket of tickets.slice(0, 5)) {
          response += ticketService.formatTicketForWhatsApp(ticket) + '\n\n';
        }

        return response;
      } catch (error) {
        logger.error('Error fetching tickets:', error);
        return '❌ Erreur lors de la récupération des tickets.';
      }
    },
  },
  {
    command: 'project',
    description: 'Créer un projet / Create a new project',
    execute: async (message: string, context: ChatContext): Promise<string> => {
      try {
        const parts = message.split(' ');
        const name = parts.slice(1).join(' ');
        
        if (!name) {
          return '❌ Veuillez fournir un nom de projet.\n\n' +
                 '💡 Exemple: /project Refonte site web Nourx';
        }

        const project = await projectService.createProject(
          context.phoneNumber,
          name,
          'Projet créé via WhatsApp - En attente de description détaillée'
        );

        return `✅ *Projet créé avec succès!*\n` +
               `━━━━━━━━━━━━━━\n` +
               `📁 Nom: ${project.name}\n` +
               `🆔 ID: ${project.id}\n` +
               `🚦 Statut: Planification\n\n` +
               `Je peux vous aider à définir les jalons de ce projet.\n` +
               `Utilisez /projects pour voir tous vos projets.`;
      } catch (error) {
        logger.error('Error creating project:', error);
        return '❌ Erreur lors de la création du projet.';
      }
    },
  },
  {
    command: 'projects',
    description: 'Voir vos projets / List your projects',
    execute: async (_message: string, context: ChatContext): Promise<string> => {
      try {
        const projects = await projectService.getUserProjects(context.phoneNumber);
        
        if (projects.length === 0) {
          return '📭 Vous n\'avez aucun projet actif.';
        }

        let response = '📊 *Vos projets actifs:*\n━━━━━━━━━━━━━━\n\n';
        
        for (const project of projects.slice(0, 5)) {
          const summary = await projectService.generateProjectSummary(project);
          response += summary + '\n\n━━━━━━━━━━━━━━\n\n';
        }

        return response;
      } catch (error) {
        logger.error('Error fetching projects:', error);
        return '❌ Erreur lors de la récupération des projets.';
      }
    },
  },
  {
    command: 'remind',
    description: 'Créer un rappel / Set a reminder',
    execute: async (message: string, context: ChatContext): Promise<string> => {
      try {
        const parts = message.split(' ').slice(1);
        
        if (parts.length < 2) {
          return '❌ Usage: /remind [temps] [message]\n\n' +
                 '💡 Exemples:\n' +
                 '• /remind 2h Vérifier les emails\n' +
                 '• /remind 30m Appeler client\n' +
                 '• /remind 1d Livraison projet';
        }

        const timeStr = parts[0];
        const reminderText = parts.slice(1).join(' ');
        
        // Parse time using reminder service
        const reminderDate = reminderService.parseTimeString(`in ${timeStr}`);
        
        if (!reminderDate) {
          return '❌ Format de temps non reconnu.\n' +
                 'Utilisez: 15m, 2h, 1d, etc.';
        }

        const reminder = await reminderService.createReminder(
          context.phoneNumber,
          reminderText,
          reminderDate
        );

        return reminderService.formatReminderForWhatsApp(reminder) + '\n\n' +
               '✅ Je vous enverrai un rappel sur WhatsApp!';
      } catch (error) {
        logger.error('Error creating reminder:', error);
        return '❌ Erreur lors de la création du rappel.';
      }
    },
  },
  {
    command: 'reminders',
    description: 'Voir vos rappels / List your reminders',
    execute: async (_message: string, context: ChatContext): Promise<string> => {
      try {
        const reminders = await reminderService.getUserReminders(context.phoneNumber);
        
        if (reminders.length === 0) {
          return '📭 Vous n\'avez aucun rappel actif.';
        }

        let response = '🔔 *Vos rappels actifs:*\n━━━━━━━━━━━━━━\n\n';
        
        for (const reminder of reminders.slice(0, 5)) {
          response += reminderService.formatReminderForWhatsApp(reminder) + '\n\n';
        }

        return response;
      } catch (error) {
        logger.error('Error fetching reminders:', error);
        return '❌ Erreur lors de la récupération des rappels.';
      }
    },
  },
  {
    command: 'schedule',
    description: 'Programmer un message / Schedule a message',
    execute: async (message: string, context: ChatContext): Promise<string> => {
      const { scheduleCommand } = await import('../commands/schedule.command');
      const args = message.split(' ').slice(1);
      return await scheduleCommand.handle(args, context) || '❌ Erreur de commande';
    },
  },
  {
    command: 'doc',
    description: 'Gérer vos documents / Manage your documents',
    execute: async (message: string, context: ChatContext): Promise<string> => {
      const parts = message.split(' ');
      const subCommand = parts[1]?.toLowerCase();

      switch (subCommand) {
        case 'list':
          try {
            const documents = await documentService.getUserDocuments(context.phoneNumber);
            if (documents.length === 0) {
              return '📭 Vous n\'avez aucun document.\n\nEnvoyez-moi un PDF, Word ou Excel pour commencer!';
            }
            
            let response = '📄 *Vos documents:*\n━━━━━━━━━━━━━━\n\n';
            for (const doc of documents) {
              response += `📎 *${doc.fileName}*\n`;
              response += `   ID: ${doc.id}\n`;
              response += `   Taille: ${(doc.fileSize / 1024).toFixed(2)} KB\n`;
              response += `   Date: ${new Date(doc.uploadedAt).toLocaleDateString()}\n\n`;
            }
            return response;
          } catch (error) {
            logger.error('Error listing documents:', error);
            return '❌ Erreur lors de la récupération des documents.';
          }

        case 'delete':
          const docId = parts[2];
          if (!docId) {
            return '❌ Usage: /doc delete [id]';
          }
          try {
            const success = await documentService.deleteDocument(docId, context.phoneNumber);
            return success 
              ? '✅ Document supprimé avec succès!'
              : '❌ Document non trouvé ou erreur lors de la suppression.';
          } catch (error) {
            logger.error('Error deleting document:', error);
            return '❌ Erreur lors de la suppression du document.';
          }

        case 'query':
          const question = parts.slice(2).join(' ');
          if (!question) {
            return '❌ Usage: /doc query [votre question]';
          }
          try {
            const answer = await simpleDocumentQAService.answerQuestion(context.phoneNumber, question);
            return answer;
          } catch (error) {
            logger.error('Error querying documents:', error);
            return '❌ Erreur lors de la recherche dans les documents.';
          }

        case 'search':
          const searchQuery = parts.slice(2).join(' ');
          if (!searchQuery) {
            return '❌ Usage: /doc search [terme de recherche]';
          }
          try {
            const results = await simpleDocumentQAService.searchDocuments(context.phoneNumber, searchQuery);
            return results;
          } catch (error) {
            logger.error('Error searching documents:', error);
            return '❌ Erreur lors de la recherche dans les documents.';
          }

        case 'summary':
          try {
            const summary = await simpleDocumentQAService.summarizeAllDocuments(context.phoneNumber);
            return summary;
          } catch (error) {
            logger.error('Error summarizing documents:', error);
            return '❌ Erreur lors de la création du résumé.';
          }

        case 'info':
          const infoId = parts[2];
          if (!infoId) {
            return '❌ Usage: /doc info [id]';
          }
          try {
            const doc = await documentService.getDocument(infoId, context.phoneNumber);
            if (!doc) {
              return '❌ Document non trouvé.';
            }
            let response = `📄 *Informations du document:*\n` +
                   `━━━━━━━━━━━━━━\n\n` +
                   `📎 Nom: ${doc.fileName}\n` +
                   `🆔 ID: ${doc.id}\n` +
                   `📊 Taille: ${(doc.fileSize / 1024).toFixed(2)} KB\n` +
                   `🏷️ Type: ${doc.fileType}\n` +
                   `📅 Uploadé: ${new Date(doc.uploadedAt).toLocaleString()}\n` +
                   `🔍 Dernier accès: ${new Date(doc.lastAccessedAt).toLocaleString()}\n`;
            
            if (doc.extractedText) {
              response += `\n📝 *Extrait du contenu:*\n`;
              response += `${doc.extractedText.substring(0, 300)}...\n\n`;
              response += `💡 Utilisez /doc query [question] pour interroger ce document.`;
            } else {
              response += `\n⚠️ Le contenu n'a pas encore été extrait.`;
            }
            
            return response;
          } catch (error) {
            logger.error('Error getting document info:', error);
            return '❌ Erreur lors de la récupération des informations.';
          }

        default:
          return '📄 *Commandes Documents:*\n' +
                 '━━━━━━━━━━━━━━\n\n' +
                 '• /doc list - Voir vos documents\n' +
                 '• /doc delete [id] - Supprimer un document\n' +
                 '• /doc query [question] - Poser une question\n' +
                 '• /doc search [terme] - Rechercher dans les documents\n' +
                 '• /doc summary - Résumé de tous vos documents\n' +
                 '• /doc info [id] - Détails d\'un document\n\n' +
                 '📎 Envoyez-moi directement un fichier PDF, Word ou Excel pour l\'analyser!';
      }
    },
  },
  {
    command: 'human',
    description: 'Demander assistance humaine / Request human assistance',
    execute: async (_message: string, context: ChatContext): Promise<string> => {
      try {
        const ticket = await ticketService.createTicket(
          context.phoneNumber,
          'Demande d\'assistance humaine',
          'Le client a demandé à parler à un humain',
          'urgent',
          true
        );

        return `🤝 *Escalade vers un humain*\n` +
               `━━━━━━━━━━━━━━\n\n` +
               ticketService.formatTicketForWhatsApp(ticket) + '\n\n' +
               `🕑 Un membre de l\'équipe Nourx vous contactera très bientôt.\n` +
               `📍 Heures d\'ouverture: Lun-Ven 8h-18h (GMT)`;
      } catch (error) {
        logger.error('Error escalating to human:', error);
        return '❌ Erreur lors de l\'escalade. Appelez directement le support.';
      }
    },
  },
];

export class CommandHandlerService {
  private commandPrefix: string = '/';

  isCommand(message: string): boolean {
    return message.startsWith(this.commandPrefix);
  }

  async handleCommand(message: string, context: ChatContext): Promise<string | null> {
    if (!this.isCommand(message)) {
      return null;
    }

    const parts = message.slice(this.commandPrefix.length).split(' ');
    const commandName = parts[0]?.toLowerCase();

    if (!commandName) {
      return null;
    }

    // Check if it's an admin command
    if (commandName === 'admin') {
      return await adminHandler.handleAdminCommand(context.phoneNumber, message);
    }

    const command = commands.find((cmd) => cmd.command === commandName);

    if (!command) {
      return `Unknown command: ${commandName}. Type /help for available commands.`;
    }

    try {
      return await command.execute(message, context);
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error);
      return `Error executing command. Please try again.`;
    }
  }

  getCommands(): CommandHandler[] {
    return commands;
  }

  setCommandPrefix(prefix: string): void {
    this.commandPrefix = prefix;
  }
}

export const commandHandler = new CommandHandlerService();