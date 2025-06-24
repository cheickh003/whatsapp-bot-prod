const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: './config/.env' });

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function testConnection() {
    console.log('Testing Appwrite connection...');
    console.log('Endpoint:', process.env.APPWRITE_ENDPOINT);
    console.log('Project ID:', process.env.APPWRITE_PROJECT_ID);
    console.log('API Key:', process.env.APPWRITE_API_KEY.substring(0, 20) + '...');
    
    try {
        // Try to list databases
        const response = await databases.list();
        console.log('✅ Connection successful!');
        console.log('Available databases:', response.databases.map(db => db.name));
        
        // Try to access the main database
        if (process.env.DATABASE_ID) {
            try {
                const collections = await databases.listCollections(process.env.DATABASE_ID);
                console.log(`✅ Database '${process.env.DATABASE_ID}' found with ${collections.collections.length} collections`);
            } catch (dbError) {
                console.log(`⚠️  Database '${process.env.DATABASE_ID}' not found. You may need to create it.`);
            }
        }
        
    } catch (error) {
        console.error('❌ Connection failed!');
        console.error('Error:', error.message);
        console.error('Response:', error.response);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n🔍 Troubleshooting tips:');
            console.error('1. Check if Appwrite is running on http://192.168.1.3');
            console.error('2. Verify the endpoint URL is correct');
            console.error('3. Check firewall settings');
        } else if (error.code === 401) {
            console.error('\n🔍 Authentication failed:');
            console.error('1. Verify your API key is correct');
            console.error('2. Check if the key has the necessary permissions');
            console.error('3. Ensure the project ID matches');
        }
    }
}

testConnection().then(() => {
    console.log('\nTest completed.');
    process.exit(0);
}).catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});