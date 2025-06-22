import { Client, Databases, ID } from 'node-appwrite';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.APPWRITE_ENDPOINT) {
  throw new Error('APPWRITE_ENDPOINT is not defined in environment variables');
}

if (!process.env.APPWRITE_PROJECT_ID) {
  throw new Error('APPWRITE_PROJECT_ID is not defined in environment variables');
}

if (!process.env.APPWRITE_API_KEY) {
  throw new Error('APPWRITE_API_KEY is not defined in environment variables');
}

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

export const appwriteConfig = {
  client,
  databases,
  databaseId: process.env.DATABASE_ID || 'whatsapp_chatbot_db',
  collections: {
    conversations: process.env.CONVERSATIONS_COLLECTION_ID || 'conversations',
    messages: process.env.MESSAGES_COLLECTION_ID || 'messages',
    daily_reports: process.env.DAILY_REPORTS_COLLECTION_ID || 'daily_reports',
  },
};

export { ID };