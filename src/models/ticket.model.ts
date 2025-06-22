export interface Ticket {
  $id: string;
  ticketNumber: string;
  phoneNumber: string;
  userId?: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'technical' | 'billing' | 'general' | 'other';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  conversationId: string;
  escalatedToHuman: boolean;
  humanAgentId?: string;
  notes?: string[];
  attachments?: string[];
}

export interface TicketComment {
  $id: string;
  ticketId: string;
  authorId: string;
  authorType: 'user' | 'agent' | 'system';
  content: string;
  createdAt: string;
  isInternal: boolean;
}