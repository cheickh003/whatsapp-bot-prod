import { EventEmitter } from 'events';

export class MockWhatsAppClient extends EventEmitter {
  info = {
    wid: {
      _serialized: '2250799997722@c.us',
      user: '2250799997722',
      server: 'c.us'
    },
    pushname: 'Test Bot',
    platform: 'android'
  };

  ready = false;

  async initialize() {
    this.ready = true;
    this.emit('ready');
  }

  async sendMessage(to: string, content: string) {
    return {
      id: {
        _serialized: `message_${Date.now()}`
      },
      from: this.info.wid._serialized,
      to,
      body: content,
      timestamp: Date.now(),
      fromMe: true
    };
  }

  async getChatById(chatId: string) {
    return {
      id: {
        _serialized: chatId
      },
      sendStateTyping: jest.fn(),
      clearState: jest.fn()
    };
  }

  async destroy() {
    this.ready = false;
    this.emit('disconnected', 'Test disconnection');
  }
}

export class MockMessage {
  id = {
    _serialized: `message_${Date.now()}`
  };
  from = '22570000000@c.us';
  to = '2250799997722@c.us';
  body = 'Test message';
  timestamp = Date.now();
  hasMedia = false;
  hasQuotedMsg = false;
  type = 'chat';
  fromMe = false;
  author?: string;
  mentionedIds: any[] = [];

  constructor(overrides?: Partial<MockMessage>) {
    Object.assign(this, overrides);
  }

  async downloadMedia() {
    if (!this.hasMedia) {
      return null;
    }
    return {
      mimetype: 'audio/ogg',
      data: Buffer.from('mock audio data').toString('base64')
    };
  }

  async getQuotedMessage() {
    if (!this.hasQuotedMsg) {
      return null;
    }
    return new MockMessage({
      id: { _serialized: 'quoted_message' },
      body: 'Quoted message content',
      from: this.to,
      to: this.from,
      fromMe: true
    });
  }

  async getChat() {
    return {
      id: { _serialized: this.from },
      name: 'Test Chat',
      isGroup: this.from.includes('@g.us')
    };
  }

  async getContact() {
    return {
      id: { _serialized: this.from },
      number: this.from.split('@')[0],
      pushname: 'Test User',
      isMyContact: true
    };
  }

  async reply(content: string) {
    return new MockMessage({
      body: content,
      from: this.to,
      to: this.from,
      fromMe: true
    });
  }

  async delete(everyone = false) {
    // Mock delete
  }
}

export function createMockGroupMessage(options?: {
  body?: string;
  author?: string;
  mentions?: string[];
}) {
  const message = new MockMessage({
    from: '120363400852891870@g.us',
    to: '2250799997722@c.us',
    body: options?.body || 'Test group message',
    author: options?.author || '22570000001@c.us'
  });

  if (options?.mentions) {
    message.mentionedIds = options.mentions.map(id => ({
      _serialized: id,
      user: id.split('@')[0],
      server: id.split('@')[1]
    }));
  }

  return message;
}

export function createMockPrivateMessage(options?: {
  from?: string;
  body?: string;
  hasMedia?: boolean;
  type?: string;
}) {
  return new MockMessage({
    from: options?.from || '22570000000@c.us',
    to: '2250799997722@c.us',
    body: options?.body || 'Test private message',
    hasMedia: options?.hasMedia || false,
    type: options?.type || 'chat'
  });
}