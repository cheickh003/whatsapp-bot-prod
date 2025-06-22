const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function checkAllConversations() {
  try {
    console.log('Checking all conversations in database...\n');
    
    // List all conversations
    const conversations = await databases.listDocuments(
      process.env.DATABASE_ID || 'whatsapp_chatbot_db',
      process.env.CONVERSATIONS_COLLECTION_ID || 'conversations'
    );
    
    console.log(`Found ${conversations.total} conversations:\n`);
    
    for (const conv of conversations.documents) {
      console.log(`Conversation ${conv.$id}:`);
      console.log(`  Phone: ${conv.phoneNumber}`);
      console.log(`  Created: ${conv.createdAt}`);
      console.log(`  Last Message: ${conv.lastMessageAt}`);
      
      // Get last few messages
      const messages = await databases.listDocuments(
        process.env.DATABASE_ID || 'whatsapp_chatbot_db',
        process.env.MESSAGES_COLLECTION_ID || 'messages',
        [
          Query.equal('conversationId', conv.$id),
          Query.orderDesc('timestamp'),
          Query.limit(3)
        ]
      );
      
      console.log(`  Last ${messages.documents.length} messages:`);
      messages.documents.reverse().forEach((msg, idx) => {
        console.log(`    ${idx + 1}. [${msg.role}] ${msg.content.substring(0, 60)}...`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

const { Query } = require('node-appwrite');
checkAllConversations();