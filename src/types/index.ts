export interface ChatContext {
  conversationId: string;
  phoneNumber: string;
  messageHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface BotConfig {
  maxHistoryLength: number;
  typingDelay: number;
  commandPrefix: string;
}

export interface CommandHandler {
  command: string;
  description: string;
  execute: (message: string, context: ChatContext) => Promise<string>;
}