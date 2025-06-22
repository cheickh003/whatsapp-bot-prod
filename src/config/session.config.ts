import { LocalAuth } from 'whatsapp-web.js';

export function createAuthStrategy(): LocalAuth {
  return new LocalAuth({
    clientId: 'jarvis-bot-nourx'
  });
}