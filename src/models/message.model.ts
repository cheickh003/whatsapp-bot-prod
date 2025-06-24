import { Message as WAMessage } from 'whatsapp-web.js';

export enum MessageType {
  TEXT = 'text',
  VOICE = 'voice',
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  UNKNOWN = 'unknown'
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  isGroupMsg: boolean;
  type: MessageType;
  hasMedia: boolean;
  isProcessing?: boolean;
  transcription?: string;
  transcriptionStatus?: 'pending' | 'completed' | 'failed';
  mediaUrl?: string;
  author?: string; // Author ID in group messages
}

export const parseWhatsAppMessage = (message: WAMessage): WhatsAppMessage => {
  let messageType = MessageType.TEXT;
  
  if (message.hasMedia) {
    switch (message.type) {
      case 'ptt': // Push to talk (voice message)
        messageType = MessageType.VOICE;
        break;
      case 'audio':
        messageType = MessageType.VOICE;
        break;
      case 'image':
        messageType = MessageType.IMAGE;
        break;
      case 'video':
        messageType = MessageType.VIDEO;
        break;
      case 'document':
        messageType = MessageType.DOCUMENT;
        break;
      default:
        messageType = MessageType.UNKNOWN;
    }
  }

  const result: WhatsAppMessage = {
    id: message.id._serialized,
    from: message.from,
    to: message.to,
    body: message.body,
    timestamp: message.timestamp,
    isGroupMsg: message.from.includes('@g.us'),
    type: messageType,
    hasMedia: message.hasMedia,
  };
  
  if (message.author) {
    result.author = message.author;
  }
  
  return result;
};