import { scheduledMessageService } from '../services/scheduled-message.service';
import { ChatContext } from '../types';
import { logger } from '../utils/logger';

export class ScheduleCommand {
  async handle(args: string[], context: ChatContext): Promise<string | null> {
    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
      case 'help':
        return this.showHelp();
        
      case 'add':
      case 'new':
        return this.scheduleMessage(args.slice(1), context);
        
      case 'list':
      case 'liste':
        return this.listScheduledMessages(context);
        
      case 'cancel':
      case 'annuler':
        return this.cancelScheduledMessage(args[1] || '', context);
        
      default:
        // If no subcommand, try to parse as a direct schedule command
        if (args.length > 0) {
          return this.scheduleMessage(args, context);
        }
        return this.showHelp();
    }
  }

  private showHelp(): string {
    return `📅 *Commandes de messages programmés*

*Programmer un message:*
• /schedule add [date/heure] [message]
• /schedule dans 2 heures Rappel de la réunion
• /schedule demain 10h30 Bonjour, n'oubliez pas notre RDV
• /schedule 25/12/2024 08:00 Joyeux Noël ! 🎄

*Formats de date acceptés:*
• dans X minutes/heures/jours
• demain [heure]
• DD/MM/YYYY HH:mm
• HH:mm (pour aujourd'hui ou demain)

*Autres commandes:*
• /schedule list - Voir vos messages programmés
• /schedule cancel [ID] - Annuler un message programmé

*Exemples:*
• /schedule dans 30 minutes Rappel: prendre les médicaments
• /schedule demain 9h Bonjour! Bonne journée
• /schedule 31/12/2024 23:59 Bonne année! 🎉`;
  }

  private async scheduleMessage(args: string[], context: ChatContext): Promise<string> {
    if (args.length < 2) {
      return '❌ Format incorrect. Utilisez: /schedule [date/heure] [message]\n\nExemple: /schedule dans 1 heure Rappel important';
    }

    try {
      // Find where the message starts (after date/time specification)
      let dateEndIndex = 1;
      let dateTimeStr = args[0];

      // Handle multi-word date specifications
      if (args[0] && (args[0].toLowerCase() === 'dans' || args[0].toLowerCase() === 'demain')) {
        dateEndIndex = 2;
        dateTimeStr = `${args[0]} ${args[1]}`;
        
        // For "demain 10h30" format
        if (args[0] && args[0].toLowerCase() === 'demain' && args.length > 2 && args[2] && args[2].match(/\d{1,2}h/)) {
          dateEndIndex = 3;
          dateTimeStr = `${args[0]} ${args[1]} ${args[2]}`;
        }
      }
      // Handle DD/MM/YYYY HH:mm format
      else if (args[0] && args[0].match(/\d{1,2}\/\d{1,2}\/\d{4}/) && args[1]?.match(/\d{1,2}:\d{2}/)) {
        dateEndIndex = 2;
        dateTimeStr = `${args[0]} ${args[1]}`;
      }

      // Parse the scheduled time
      const scheduledTime = scheduledMessageService.parseScheduleTime(dateTimeStr || '');
      
      if (!scheduledTime) {
        return `❌ Format de date invalide: "${dateTimeStr}"\n\nUtilisez un format comme:\n• dans 30 minutes\n• demain 10h\n• 25/12/2024 15:30`;
      }

      // Get the message content
      const message = args.slice(dateEndIndex).join(' ').trim();
      
      if (!message) {
        return '❌ Veuillez spécifier un message à envoyer';
      }

      // Schedule the message
      const result = await scheduledMessageService.scheduleMessage(
        context.phoneNumber,
        message,
        scheduledTime,
        context.phoneNumber
      );

      if (result.success) {
        const formattedTime = scheduledMessageService.formatScheduledTime(scheduledTime);
        return `✅ Message programmé avec succès!\n\n📅 *Date d'envoi:* ${formattedTime}\n💬 *Message:* ${message}\n🆔 *ID:* ${result.messageId}\n\n_Pour annuler: /schedule cancel ${result.messageId}_`;
      } else {
        return `❌ Erreur: ${result.error}`;
      }
    } catch (error: any) {
      logger.error('Erreur lors de la programmation du message:', error);
      return '❌ Une erreur est survenue lors de la programmation du message';
    }
  }

  private async listScheduledMessages(context: ChatContext): Promise<string> {
    try {
      const messages = await scheduledMessageService.listScheduledMessages(context.phoneNumber);

      if (messages.length === 0) {
        return '📭 Vous n\'avez aucun message programmé';
      }

      let response = `📅 *Vos messages programmés (${messages.length}):*\n`;

      messages.forEach((msg, index) => {
        const scheduledTime = new Date(msg.scheduledTime);
        const formattedTime = scheduledMessageService.formatScheduledTime(scheduledTime);
        const preview = msg.message.length > 50 ? msg.message.substring(0, 50) + '...' : msg.message;
        
        response += `\n${index + 1}. 📝 ${preview}\n`;
        response += `   📅 ${formattedTime}\n`;
        response += `   🆔 ID: ${msg.$id}\n`;
      });

      response += '\n_Pour annuler un message, utilisez: /schedule cancel [ID]_';

      return response;
    } catch (error: any) {
      logger.error('Erreur lors de la récupération des messages programmés:', error);
      return '❌ Une erreur est survenue lors de la récupération des messages programmés';
    }
  }

  private async cancelScheduledMessage(messageId: string, context: ChatContext): Promise<string> {
    if (!messageId) {
      return '❌ Veuillez spécifier l\'ID du message à annuler\n\nExemple: /schedule cancel MSG123';
    }

    try {
      const success = await scheduledMessageService.cancelScheduledMessage(messageId, context.phoneNumber);

      if (success) {
        return `✅ Message programmé annulé avec succès!\n\n🆔 ID: ${messageId}`;
      } else {
        return `❌ Impossible d'annuler ce message. Vérifiez l'ID ou le message a peut-être déjà été envoyé.`;
      }
    } catch (error: any) {
      logger.error('Erreur lors de l\'annulation du message programmé:', error);
      return '❌ Une erreur est survenue lors de l\'annulation du message';
    }
  }
}

export const scheduleCommand = new ScheduleCommand();