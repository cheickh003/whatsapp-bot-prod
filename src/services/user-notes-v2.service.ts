import { appwriteService } from './appwrite.service';
import { logger } from '../utils/logger';
import { ID, Query } from 'node-appwrite';

export class UserNotesV2Service {
  private readonly NOTES_COLLECTION = 'user_notes';
  private readonly LISTS_COLLECTION = 'user_lists';

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing user notes service...');
      
      // Créer la collection pour les notes
      await appwriteService.ensureCollection(
        this.NOTES_COLLECTION,
        [
          { key: 'userId', type: 'string', size: 255, required: true },
          { key: 'key', type: 'string', size: 255, required: true },
          { key: 'value', type: 'string', size: 5000, required: true },
          { key: 'createdAt', type: 'datetime', required: true },
          { key: 'updatedAt', type: 'datetime', required: true }
        ]
      );

      // Créer la collection pour les listes
      await appwriteService.ensureCollection(
        this.LISTS_COLLECTION,
        [
          { key: 'userId', type: 'string', size: 255, required: true },
          { key: 'name', type: 'string', size: 255, required: true },
          { key: 'items', type: 'string', size: 10000, required: true }, // JSON array
          { key: 'createdAt', type: 'datetime', required: true },
          { key: 'updatedAt', type: 'datetime', required: true }
        ]
      );

      logger.info('User notes service initialized successfully');
    } catch (error) {
      logger.error('Error initializing user notes service:', error);
    }
  }

  // === NOTES ===

  async saveNote(userId: string, key: string, value: string): Promise<boolean> {
    try {
      const existingNotes = await appwriteService.listDocuments(
        this.NOTES_COLLECTION,
        [
          Query.equal('userId', userId),
          Query.equal('key', key.toLowerCase())
        ],
        1
      );

      const now = new Date().toISOString();

      if (existingNotes.documents.length > 0) {
        await appwriteService.updateDocument(
          this.NOTES_COLLECTION,
          existingNotes.documents[0].$id,
          {
            value,
            updatedAt: now
          }
        );
      } else {
        await appwriteService.createDocument(
          this.NOTES_COLLECTION,
          ID.unique(),
          {
            userId,
            key: key.toLowerCase(),
            value,
            createdAt: now,
            updatedAt: now
          }
        );
      }

      logger.info(`Note saved for user ${userId}: ${key}`);
      return true;
    } catch (error) {
      logger.error('Error saving note:', error);
      return false;
    }
  }

  async getNote(userId: string, key: string): Promise<string | null> {
    try {
      const notes = await appwriteService.listDocuments(
        this.NOTES_COLLECTION,
        [
          Query.equal('userId', userId),
          Query.equal('key', key.toLowerCase())
        ],
        1
      );

      if (notes.documents.length > 0) {
        return notes.documents[0].value;
      }

      return null;
    } catch (error) {
      logger.error('Error getting note:', error);
      return null;
    }
  }

  async getAllNotes(userId: string): Promise<{ key: string; value: string }[]> {
    try {
      const notes = await appwriteService.listDocuments(
        this.NOTES_COLLECTION,
        [
          Query.equal('userId', userId),
          Query.orderDesc('updatedAt')
        ],
        100
      );

      return notes.documents.map((doc: any) => ({
        key: doc.key,
        value: doc.value
      }));
    } catch (error) {
      logger.error('Error getting all notes:', error);
      return [];
    }
  }

  async deleteNote(userId: string, key: string): Promise<boolean> {
    try {
      const notes = await appwriteService.listDocuments(
        this.NOTES_COLLECTION,
        [
          Query.equal('userId', userId),
          Query.equal('key', key.toLowerCase())
        ],
        1
      );

      if (notes.documents.length > 0) {
        await appwriteService.deleteDocument(
          this.NOTES_COLLECTION,
          notes.documents[0].$id
        );
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error deleting note:', error);
      return false;
    }
  }

  // === LISTES ===

  async addToList(userId: string, listName: string, item: string): Promise<boolean> {
    try {
      const lists = await appwriteService.listDocuments(
        this.LISTS_COLLECTION,
        [
          Query.equal('userId', userId),
          Query.equal('name', listName.toLowerCase())
        ],
        1
      );

      const now = new Date().toISOString();

      if (lists.documents.length > 0) {
        const list = lists.documents[0];
        const items = JSON.parse(list.items);
        
        if (!items.includes(item)) {
          items.push(item);
          
          await appwriteService.updateDocument(
            this.LISTS_COLLECTION,
            list.$id,
            {
              items: JSON.stringify(items),
              updatedAt: now
            }
          );
        }
      } else {
        await appwriteService.createDocument(
          this.LISTS_COLLECTION,
          ID.unique(),
          {
            userId,
            name: listName.toLowerCase(),
            items: JSON.stringify([item]),
            createdAt: now,
            updatedAt: now
          }
        );
      }

      logger.info(`Item added to list ${listName} for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error adding to list:', error);
      return false;
    }
  }

  async removeFromList(userId: string, listName: string, item: string): Promise<boolean> {
    try {
      const lists = await appwriteService.listDocuments(
        this.LISTS_COLLECTION,
        [
          Query.equal('userId', userId),
          Query.equal('name', listName.toLowerCase())
        ],
        1
      );

      if (lists.documents.length > 0) {
        const list = lists.documents[0];
        const items = JSON.parse(list.items);
        const newItems = items.filter((i: string) => i.toLowerCase() !== item.toLowerCase());
        
        if (newItems.length < items.length) {
          await appwriteService.updateDocument(
            this.LISTS_COLLECTION,
            list.$id,
            {
              items: JSON.stringify(newItems),
              updatedAt: new Date().toISOString()
            }
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error removing from list:', error);
      return false;
    }
  }

  async getList(userId: string, listName: string): Promise<string[] | null> {
    try {
      const lists = await appwriteService.listDocuments(
        this.LISTS_COLLECTION,
        [
          Query.equal('userId', userId),
          Query.equal('name', listName.toLowerCase())
        ],
        1
      );

      if (lists.documents.length > 0) {
        return JSON.parse(lists.documents[0].items);
      }

      return null;
    } catch (error) {
      logger.error('Error getting list:', error);
      return null;
    }
  }

  async clearList(userId: string, listName: string): Promise<boolean> {
    try {
      const lists = await appwriteService.listDocuments(
        this.LISTS_COLLECTION,
        [
          Query.equal('userId', userId),
          Query.equal('name', listName.toLowerCase())
        ],
        1
      );

      if (lists.documents.length > 0) {
        await appwriteService.updateDocument(
          this.LISTS_COLLECTION,
          lists.documents[0].$id,
          {
            items: JSON.stringify([]),
            updatedAt: new Date().toISOString()
          }
        );
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error clearing list:', error);
      return false;
    }
  }

  async getAllLists(userId: string): Promise<{ name: string; count: number }[]> {
    try {
      const lists = await appwriteService.listDocuments(
        this.LISTS_COLLECTION,
        [
          Query.equal('userId', userId),
          Query.orderDesc('updatedAt')
        ],
        100
      );

      return lists.documents.map((doc: any) => ({
        name: doc.name,
        count: JSON.parse(doc.items).length
      }));
    } catch (error) {
      logger.error('Error getting all lists:', error);
      return [];
    }
  }

  // === DÉTECTION DE LANGAGE NATUREL ===

  detectNoteIntent(text: string): { action: 'save' | 'get' | 'delete' | 'list'; key?: string; value?: string } | null {
    // Sauvegarder une note
    let match = text.match(/note\s+que\s+(?:le\s+|la\s+|les\s+)?(.+?)\s+(?:est|sont|c'est)\s+(.+)/i);
    if (match && match[1] && match[2]) {
      return {
        action: 'save',
        key: match[1].trim(),
        value: match[2].trim()
      };
    }

    // Récupérer une note
    match = text.match(/(?:qu'est[- ]ce que|c'est quoi|quel est)\s+(?:le\s+|la\s+)?(.+?)\s*\?/i);
    if (match && match[1]) {
      return {
        action: 'get',
        key: match[1].trim()
      };
    }

    // Lister toutes les notes
    if (/(?:montre|affiche|liste)\s+mes\s+notes/i.test(text)) {
      return { action: 'list' };
    }

    // Supprimer une note
    match = text.match(/(?:supprime|efface|oublie)\s+(?:la note sur|le|la)\s+(.+)/i);
    if (match && match[1]) {
      return {
        action: 'delete',
        key: match[1].trim()
      };
    }

    return null;
  }

  detectListIntent(text: string): { action: 'add' | 'remove' | 'get' | 'clear' | 'list'; listName?: string; item?: string } | null {
    // Ajouter à une liste
    let match = text.match(/ajoute\s+(.+?)\s+(?:à|dans)\s+(?:ma\s+)?liste\s+(?:de\s+)?(.+)/i);
    if (match && match[1] && match[2]) {
      return {
        action: 'add',
        listName: match[2].trim(),
        item: match[1].trim()
      };
    }

    // Voir une liste
    match = text.match(/(?:montre|affiche|qu'est[- ]ce qu'il y a dans)\s+(?:ma\s+)?liste\s+(?:de\s+)?(.+)/i);
    if (match && match[1]) {
      return {
        action: 'get',
        listName: match[1].trim()
      };
    }

    // Effacer une liste
    match = text.match(/(?:efface|vide|supprime)\s+(?:ma\s+)?liste\s+(?:de\s+)?(.+)/i);
    if (match && match[1]) {
      return {
        action: 'clear',
        listName: match[1].trim()
      };
    }

    // Retirer d'une liste
    match = text.match(/(?:retire|enlève|supprime)\s+(.+?)\s+de\s+(?:ma\s+)?liste\s+(?:de\s+)?(.+)/i);
    if (match && match[1] && match[2]) {
      return {
        action: 'remove',
        listName: match[2].trim(),
        item: match[1].trim()
      };
    }

    // Lister toutes les listes
    if (/(?:mes\s+listes|toutes\s+mes\s+listes)/i.test(text)) {
      return { action: 'list' };
    }

    return null;
  }
}

export const userNotesV2Service = new UserNotesV2Service();