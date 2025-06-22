import { appwriteService } from './appwrite.service';
import { logger } from '../utils/logger';
import { ID } from 'node-appwrite';

interface Ticket {
  id: string;
  userId: string;
  phoneNumber: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  escalated: boolean;
}

interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  createdAt: string;
  isInternal: boolean;
}

export class TicketService {
  private readonly COLLECTION_ID = 'tickets';
  private readonly COMMENTS_COLLECTION_ID = 'ticket_comments';

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing ticket service...');
      
      // Create tickets collection
      await appwriteService.createCollection(this.COLLECTION_ID, 'Tickets');
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'userId', 50, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'phoneNumber', 50, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'subject', 200, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'description', 5000, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'status', 20, true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'priority', 20, true);
      await appwriteService.createDatetimeAttribute(this.COLLECTION_ID, 'createdAt', true);
      await appwriteService.createDatetimeAttribute(this.COLLECTION_ID, 'updatedAt', true);
      await appwriteService.createStringAttribute(this.COLLECTION_ID, 'assignedTo', 50, false);
      await appwriteService.createBooleanAttribute(this.COLLECTION_ID, 'escalated', true);

      // Create ticket comments collection
      await appwriteService.createCollection(this.COMMENTS_COLLECTION_ID, 'Ticket Comments');
      await appwriteService.createStringAttribute(this.COMMENTS_COLLECTION_ID, 'ticketId', 50, true);
      await appwriteService.createStringAttribute(this.COMMENTS_COLLECTION_ID, 'authorId', 50, true);
      await appwriteService.createStringAttribute(this.COMMENTS_COLLECTION_ID, 'content', 5000, true);
      await appwriteService.createDatetimeAttribute(this.COMMENTS_COLLECTION_ID, 'createdAt', true);
      await appwriteService.createBooleanAttribute(this.COMMENTS_COLLECTION_ID, 'isInternal', true);

      logger.info('Ticket service initialized successfully');
    } catch (error) {
      logger.error('Error initializing ticket service:', error);
      throw error;
    }
  }

  async createTicket(
    phoneNumber: string,
    subject: string,
    description: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    escalated: boolean = false
  ): Promise<Ticket> {
    try {
      const ticketNumber = await this.generateTicketNumber();
      const now = new Date().toISOString();
      
      const ticket = await appwriteService.createDocument(this.COLLECTION_ID, ID.unique(), {
        userId: phoneNumber,
        phoneNumber,
        subject: `#${ticketNumber} - ${subject}`,
        description,
        status: 'open',
        priority,
        createdAt: now,
        updatedAt: now,
        escalated
      });

      logger.info(`Ticket created: ${ticket.$id} for ${phoneNumber}`);
      return this.mapToTicket(ticket);
    } catch (error) {
      logger.error('Error creating ticket:', error);
      throw error;
    }
  }

  async getTicket(ticketId: string): Promise<Ticket | null> {
    try {
      const document = await appwriteService.getDocument(this.COLLECTION_ID, ticketId);
      return document ? this.mapToTicket(document) : null;
    } catch (error) {
      logger.error('Error getting ticket:', error);
      return null;
    }
  }

  async getUserTickets(phoneNumber: string, status?: string): Promise<Ticket[]> {
    try {
      const queries = [`phoneNumber="${phoneNumber}"`];
      if (status) {
        queries.push(`status="${status}"`);
      }
      
      const documents = await appwriteService.listDocuments(
        this.COLLECTION_ID,
        queries,
        25,
        0,
        ['createdAt'],
        ['DESC']
      );

      return documents.documents.map((doc: any) => this.mapToTicket(doc));
    } catch (error) {
      logger.error('Error getting user tickets:', error);
      return [];
    }
  }

  async updateTicketStatus(ticketId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed'): Promise<Ticket | null> {
    try {
      const updated = await appwriteService.updateDocument(this.COLLECTION_ID, ticketId, {
        status,
        updatedAt: new Date().toISOString()
      });

      logger.info(`Ticket ${ticketId} status updated to ${status}`);
      return this.mapToTicket(updated);
    } catch (error) {
      logger.error('Error updating ticket status:', error);
      return null;
    }
  }

  async addComment(ticketId: string, authorId: string, content: string, isInternal: boolean = false): Promise<void> {
    try {
      await appwriteService.createDocument(this.COMMENTS_COLLECTION_ID, ID.unique(), {
        ticketId,
        authorId,
        content,
        createdAt: new Date().toISOString(),
        isInternal
      });

      // Update ticket's updatedAt
      await appwriteService.updateDocument(this.COLLECTION_ID, ticketId, {
        updatedAt: new Date().toISOString()
      });

      logger.info(`Comment added to ticket ${ticketId}`);
    } catch (error) {
      logger.error('Error adding comment to ticket:', error);
      throw error;
    }
  }

  async getTicketComments(ticketId: string): Promise<TicketComment[]> {
    try {
      const documents = await appwriteService.listDocuments(
        this.COMMENTS_COLLECTION_ID,
        [`ticketId="${ticketId}"`, 'isInternal=false'],
        25,
        0,
        ['createdAt'],
        ['ASC']
      );

      return documents.documents.map((doc: any) => ({
        id: doc.$id,
        ticketId: doc.ticketId,
        authorId: doc.authorId,
        content: doc.content,
        createdAt: doc.createdAt,
        isInternal: doc.isInternal
      }));
    } catch (error) {
      logger.error('Error getting ticket comments:', error);
      return [];
    }
  }

  async escalateTicket(ticketId: string): Promise<Ticket | null> {
    try {
      const updated = await appwriteService.updateDocument(this.COLLECTION_ID, ticketId, {
        escalated: true,
        priority: 'urgent',
        updatedAt: new Date().toISOString()
      });

      logger.info(`Ticket ${ticketId} escalated`);
      return this.mapToTicket(updated);
    } catch (error) {
      logger.error('Error escalating ticket:', error);
      return null;
    }
  }

  async generateTicketNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${year}${month}${random}`;
  }

  private mapToTicket(document: any): Ticket {
    return {
      id: document.$id,
      userId: document.userId,
      phoneNumber: document.phoneNumber,
      subject: document.subject,
      description: document.description,
      status: document.status,
      priority: document.priority,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      assignedTo: document.assignedTo,
      escalated: document.escalated
    };
  }

  formatTicketForWhatsApp(ticket: Ticket): string {
    const statusEmoji = {
      'open': '🔵',
      'in_progress': '🟡',
      'resolved': '🟢',
      'closed': '⚫'
    };

    const priorityEmoji = {
      'low': '⬇️',
      'medium': '➡️',
      'high': '⬆️',
      'urgent': '🚨'
    };

    return `*Ticket ${ticket.subject}*\n` +
           `━━━━━━━━━━━━━━\n` +
           `${statusEmoji[ticket.status]} Statut: ${this.translateStatus(ticket.status)}\n` +
           `${priorityEmoji[ticket.priority]} Priorité: ${this.translatePriority(ticket.priority)}\n` +
           `📅 Créé le: ${new Date(ticket.createdAt).toLocaleDateString('fr-FR')}\n` +
           `${ticket.escalated ? '⚠️ *Escaladé à un humain*\n' : ''}\n` +
           `📝 Description:\n${ticket.description}`;
  }

  private translateStatus(status: string): string {
    const translations: Record<string, string> = {
      'open': 'Ouvert',
      'in_progress': 'En cours',
      'resolved': 'Résolu',
      'closed': 'Fermé'
    };
    return translations[status] || status;
  }

  private translatePriority(priority: string): string {
    const translations: Record<string, string> = {
      'low': 'Faible',
      'medium': 'Moyenne',
      'high': 'Élevée',
      'urgent': 'Urgente'
    };
    return translations[priority] || priority;
  }
}

export const ticketService = new TicketService();