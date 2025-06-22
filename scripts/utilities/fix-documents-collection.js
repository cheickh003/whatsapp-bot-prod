const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const databaseId = process.env.DATABASE_ID || 'whatsapp_chatbot_db';

async function addChunksAttribute() {
  try {
    console.log('Adding chunks attribute to documents collection...');
    
    await databases.createStringAttribute(
      databaseId,
      'documents',
      'chunks',
      1000000,  // 1MB max
      false     // not required
    );
    
    console.log('Chunks attribute added successfully!');
  } catch (error) {
    if (error.code === 409) {
      console.log('Chunks attribute already exists');
    } else {
      console.error('Error adding chunks attribute:', error);
    }
  }
}

addChunksAttribute();