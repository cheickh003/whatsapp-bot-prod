export interface Conversation {
  $id: string;
  phoneNumber: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface Message {
  $id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}