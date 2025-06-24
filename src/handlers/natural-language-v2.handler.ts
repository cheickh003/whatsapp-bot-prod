import { naturalLanguageV2Service } from '../services/natural-language-v2.service';
import { userNotesV2Service } from '../services/user-notes-v2.service';
import { logger } from '../utils/logger';

export class NaturalLanguageV2Handler {
  async processMessage(message: string, userId: string): Promise<string | null> {
    // 1. Vérifier les conversions
    const conversion = await naturalLanguageV2Service.detectAndProcessConversion(message);
    if (conversion) {
      logger.info(`Conversion detected: ${conversion.type}`);
      return `💱 ${conversion.formatted}`;
    }

    // 2. Vérifier les calculs
    const calculation = await naturalLanguageV2Service.detectAndProcessCalculation(message);
    if (calculation) {
      logger.info(`Calculation detected: ${calculation.expression}`);
      return `🧮 ${calculation.formatted}${calculation.explanation ? '\n' + calculation.explanation : ''}`;
    }

    // 3. Vérifier pile ou face
    if (naturalLanguageV2Service.detectCoinFlip(message)) {
      logger.info('Coin flip detected');
      return naturalLanguageV2Service.flipCoin();
    }

    // 4. Vérifier nombre aléatoire
    const randomRange = naturalLanguageV2Service.detectRandomNumber(message);
    if (randomRange) {
      logger.info(`Random number requested: ${randomRange.min}-${randomRange.max}`);
      return naturalLanguageV2Service.generateRandomNumber(randomRange.min, randomRange.max);
    }

    // 5. Vérifier choix aléatoire
    const choices = naturalLanguageV2Service.detectRandomChoice(message);
    if (choices) {
      logger.info(`Random choice requested from: ${choices.join(', ')}`);
      return naturalLanguageV2Service.makeRandomChoice(choices);
    }

    // 6. Vérifier demande de mot de passe
    const passwordLength = naturalLanguageV2Service.detectPasswordRequest(message);
    if (passwordLength) {
      logger.info(`Password requested: ${passwordLength} chars`);
      const password = naturalLanguageV2Service.generatePassword(passwordLength);
      return `🔐 Voici votre mot de passe sécurisé :\n\`${password}\`\n\n_⚠️ Gardez-le en sécurité et ne le partagez pas_`;
    }

    // 7. Vérifier les notes
    const noteIntent = userNotesV2Service.detectNoteIntent(message);
    if (noteIntent) {
      return await this.handleNoteIntent(noteIntent, userId);
    }

    // 8. Vérifier les listes
    const listIntent = userNotesV2Service.detectListIntent(message);
    if (listIntent) {
      return await this.handleListIntent(listIntent, userId);
    }

    // 9. Demandes de date/temps
    if (this.detectDateTimeQuery(message)) {
      return this.handleDateTimeQuery(message);
    }

    return null; // Pas de correspondance, laisser l'IA gérer
  }

  private async handleNoteIntent(
    intent: { action: string; key?: string; value?: string },
    userId: string
  ): Promise<string> {
    switch (intent.action) {
      case 'save':
        if (intent.key && intent.value) {
          const success = await userNotesV2Service.saveNote(userId, intent.key, intent.value);
          if (success) {
            return `📝 J'ai noté que ${intent.key} est ${intent.value}`;
          }
          return '❌ Erreur lors de l\'enregistrement de la note';
        }
        break;

      case 'get':
        if (intent.key) {
          const value = await userNotesV2Service.getNote(userId, intent.key);
          if (value) {
            return `📝 ${intent.key} : ${value}`;
          }
          return `❓ Je n'ai pas de note sur "${intent.key}"`;
        }
        break;

      case 'list':
        const notes = await userNotesV2Service.getAllNotes(userId);
        if (notes.length === 0) {
          return '📝 Vous n\'avez aucune note enregistrée';
        }
        let response = '📝 **Vos notes :**\n';
        notes.forEach(note => {
          response += `• ${note.key} : ${note.value}\n`;
        });
        return response;

      case 'delete':
        if (intent.key) {
          const success = await userNotesV2Service.deleteNote(userId, intent.key);
          if (success) {
            return `🗑️ Note sur "${intent.key}" supprimée`;
          }
          return `❓ Aucune note trouvée sur "${intent.key}"`;
        }
        break;
    }

    return '❌ Je n\'ai pas compris votre demande de note';
  }

  private async handleListIntent(
    intent: { action: string; listName?: string; item?: string },
    userId: string
  ): Promise<string> {
    switch (intent.action) {
      case 'add':
        if (intent.listName && intent.item) {
          const success = await userNotesV2Service.addToList(userId, intent.listName, intent.item);
          if (success) {
            return `✅ "${intent.item}" ajouté à votre liste de ${intent.listName}`;
          }
          return '❌ Erreur lors de l\'ajout à la liste';
        }
        break;

      case 'get':
        if (intent.listName) {
          const items = await userNotesV2Service.getList(userId, intent.listName);
          if (items && items.length > 0) {
            let response = `📋 **Liste de ${intent.listName} :**\n`;
            items.forEach(item => {
              response += `• ${item}\n`;
            });
            return response;
          }
          return `📋 Votre liste de ${intent.listName} est vide`;
        }
        break;

      case 'remove':
        if (intent.listName && intent.item) {
          const success = await userNotesV2Service.removeFromList(userId, intent.listName, intent.item);
          if (success) {
            return `✅ "${intent.item}" retiré de votre liste de ${intent.listName}`;
          }
          return `❓ "${intent.item}" n'est pas dans votre liste de ${intent.listName}`;
        }
        break;

      case 'clear':
        if (intent.listName) {
          const success = await userNotesV2Service.clearList(userId, intent.listName);
          if (success) {
            return `🗑️ Liste de ${intent.listName} vidée`;
          }
          return `❓ Aucune liste de ${intent.listName} trouvée`;
        }
        break;

      case 'list':
        const lists = await userNotesV2Service.getAllLists(userId);
        if (lists.length === 0) {
          return '📋 Vous n\'avez aucune liste';
        }
        let response = '📋 **Vos listes :**\n';
        lists.forEach(list => {
          response += `• ${list.name} (${list.count} élément${list.count > 1 ? 's' : ''})\n`;
        });
        return response;
    }

    return '❌ Je n\'ai pas compris votre demande de liste';
  }

  private detectDateTimeQuery(message: string): boolean {
    return /quelle?\s+heure|date\s+(?:sommes[- ]nous|on est)|dans\s+combien\s+de\s+(?:jours?|temps)|quel\s+jour|âge\s+si/i.test(message);
  }

  private handleDateTimeQuery(message: string): string {
    const now = new Date();
    
    // Heure actuelle
    if (/quelle?\s+heure/i.test(message)) {
      const time = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Abidjan'
      });
      return `🕐 Il est ${time} à Abidjan`;
    }

    // Date actuelle
    if (/(?:quelle?\s+)?date/i.test(message)) {
      const date = now.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Africa/Abidjan'
      });
      return `📅 Nous sommes le ${date}`;
    }

    // Calcul de jours
    const daysMatch = message.match(/dans\s+combien\s+de\s+jours?\s+(?:on\s+sera\s+le\s+)?(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/i);
    if (daysMatch && daysMatch[1] && daysMatch[2]) {
      const day = parseInt(daysMatch[1]);
      const month = parseInt(daysMatch[2]) - 1;
      const year = daysMatch[3] ? 
        (daysMatch[3].length === 2 ? 2000 + parseInt(daysMatch[3]) : parseInt(daysMatch[3])) : 
        now.getFullYear();
      
      const targetDate = new Date(year, month, day);
      const diffTime = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return '📅 C\'est aujourd\'hui !';
      } else if (diffDays === 1) {
        return '📅 C\'est demain !';
      } else if (diffDays > 0) {
        return `📅 Dans ${diffDays} jours`;
      } else {
        return `📅 C\'était il y a ${Math.abs(diffDays)} jours`;
      }
    }

    // Calcul d'âge
    const ageMatch = message.match(/âge\s+si\s+(?:je suis né|ma naissance)\s+(?:le\s+)?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i);
    if (ageMatch && ageMatch[1] && ageMatch[2] && ageMatch[3]) {
      const day = parseInt(ageMatch[1]);
      const month = parseInt(ageMatch[2]) - 1;
      const year = ageMatch[3].length === 2 ? 1900 + parseInt(ageMatch[3]) : parseInt(ageMatch[3]);
      
      const birthDate = new Date(year, month, day);
      let age = now.getFullYear() - birthDate.getFullYear();
      const monthDiff = now.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return `🎂 Vous avez ${age} ans`;
    }

    return '❓ Je n\'ai pas compris votre question sur la date/heure';
  }
}

export const naturalLanguageV2Handler = new NaturalLanguageV2Handler();