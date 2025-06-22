const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

async function testConnection() {
  console.log('Testing Appwrite Cloud connection...');
  console.log('Endpoint:', process.env.APPWRITE_ENDPOINT);
  console.log('Project ID:', process.env.APPWRITE_PROJECT_ID);
  console.log('API Key:', process.env.APPWRITE_API_KEY ? 'Set' : 'Not set');

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);

  try {
    // Test 1: List databases
    console.log('\nTest 1: Listing databases...');
    const dbList = await databases.list();
    console.log('Success! Found', dbList.total, 'databases');

    // Test 2: Get specific database
    console.log('\nTest 2: Getting database...');
    const db = await databases.get(process.env.DATABASE_ID || 'whatsapp_chatbot_db');
    console.log('Database found:', db.name);

    // Test 3: List collections
    console.log('\nTest 3: Listing collections...');
    const collections = await databases.listCollections(process.env.DATABASE_ID || 'whatsapp_chatbot_db');
    console.log('Found', collections.total, 'collections');
    collections.collections.forEach(col => {
      console.log('- Collection:', col.$id);
    });

    console.log('\nAll tests passed! ✅');
  } catch (error) {
    console.error('\nError:', error.message);
    console.error('Code:', error.code);
    console.error('Type:', error.type);
    console.error('Response:', error.response);
  }
}

testConnection();