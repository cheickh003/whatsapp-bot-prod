const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: './config/.env' });

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function fixConversationsSchema() {
    console.log('🔧 Fixing conversations collection schema...\n');

    const mainDbId = process.env.DATABASE_ID || 'whatsapp_chatbot_db';
    const conversationsId = process.env.CONVERSATIONS_COLLECTION_ID || 'conversations';

    try {
        // Add missing createdAt attribute
        console.log('Adding createdAt attribute...');
        try {
            await databases.createDatetimeAttribute(
                mainDbId, 
                conversationsId, 
                'createdAt', 
                false // not required, to avoid issues with existing documents
            );
            console.log('✅ Added createdAt attribute');
        } catch (error) {
            if (error.code === 409) {
                console.log('ℹ️  createdAt attribute already exists');
            } else {
                throw error;
            }
        }

        // Check if all required attributes exist
        console.log('\nChecking all required attributes...');
        
        const requiredAttributes = [
            { name: 'phoneNumber', type: 'string' },
            { name: 'createdAt', type: 'datetime' },
            { name: 'lastMessageAt', type: 'datetime' },
            { name: 'messageCount', type: 'integer' }
        ];
        
        // Get current collection attributes
        const collection = await databases.getCollection(mainDbId, conversationsId);
        const existingAttributes = collection.attributes.map(attr => attr.key);
        
        console.log('Existing attributes:', existingAttributes);
        
        // Check and add missing attributes
        for (const attr of requiredAttributes) {
            if (!existingAttributes.includes(attr.name)) {
                console.log(`Missing attribute: ${attr.name}, adding it...`);
                try {
                    if (attr.type === 'string') {
                        await databases.createStringAttribute(mainDbId, conversationsId, attr.name, 255, false);
                    } else if (attr.type === 'datetime') {
                        await databases.createDatetimeAttribute(mainDbId, conversationsId, attr.name, false);
                    } else if (attr.type === 'integer') {
                        await databases.createIntegerAttribute(mainDbId, conversationsId, attr.name, false);
                    }
                    console.log(`✅ Added ${attr.name} attribute`);
                } catch (error) {
                    console.error(`❌ Failed to add ${attr.name}:`, error.message);
                }
            }
        }
        
        // Wait for attributes to be available
        console.log('⏳ Waiting for attributes to be available...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('\n✅ Schema fix completed!');
        console.log('\nNow rebuilding the application...');

    } catch (error) {
        console.error('❌ Error fixing schema:', error.message);
        if (error.response) {
            console.error('Response:', error.response);
        }
        process.exit(1);
    }
}

fixConversationsSchema().then(() => {
    console.log('Done!');
    process.exit(0);
}).catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});