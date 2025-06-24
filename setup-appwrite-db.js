const { Client, Databases, ID, Permission, Role } = require('node-appwrite');
require('dotenv').config({ path: './config/.env' });

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function setupDatabases() {
    console.log('🚀 Setting up Appwrite databases and collections...\n');

    try {
        // 1. Create main database
        const mainDbId = process.env.DATABASE_ID || 'whatsapp_chatbot_db';
        try {
            const mainDb = await databases.create(
                mainDbId,
                'WhatsApp Chatbot Database'
            );
            console.log(`✅ Created database: ${mainDb.name}`);
        } catch (error) {
            if (error.code === 409) {
                console.log(`ℹ️  Database '${mainDbId}' already exists`);
            } else throw error;
        }

        // 2. Create conversations collection
        const conversationsId = process.env.CONVERSATIONS_COLLECTION_ID || 'conversations';
        try {
            await databases.createCollection(
                mainDbId,
                conversationsId,
                'Conversations',
                [
                    Permission.read(Role.any()),
                    Permission.create(Role.any()),
                    Permission.update(Role.any()),
                    Permission.delete(Role.any())
                ]
            );
            
            // Add attributes
            await databases.createStringAttribute(mainDbId, conversationsId, 'phoneNumber', 255, true);
            await databases.createDatetimeAttribute(mainDbId, conversationsId, 'lastMessageAt', true);
            await databases.createIntegerAttribute(mainDbId, conversationsId, 'messageCount', true);
            
            console.log(`✅ Created collection: conversations`);
        } catch (error) {
            if (error.code === 409) {
                console.log(`ℹ️  Collection 'conversations' already exists`);
            } else throw error;
        }

        // 3. Create messages collection
        const messagesId = process.env.MESSAGES_COLLECTION_ID || 'messages';
        try {
            await databases.createCollection(
                mainDbId,
                messagesId,
                'Messages',
                [
                    Permission.read(Role.any()),
                    Permission.create(Role.any()),
                    Permission.update(Role.any()),
                    Permission.delete(Role.any())
                ]
            );
            
            // Add attributes
            await databases.createStringAttribute(mainDbId, messagesId, 'conversationId', 255, true);
            await databases.createStringAttribute(mainDbId, messagesId, 'role', 50, true);
            await databases.createStringAttribute(mainDbId, messagesId, 'content', 5000, true);
            await databases.createDatetimeAttribute(mainDbId, messagesId, 'timestamp', true);
            
            console.log(`✅ Created collection: messages`);
        } catch (error) {
            if (error.code === 409) {
                console.log(`ℹ️  Collection 'messages' already exists`);
            } else throw error;
        }

        // 4. Create admin database
        const adminDbId = 'jarvis_admin';
        try {
            const adminDb = await databases.create(
                adminDbId,
                'Jarvis Admin Database'
            );
            console.log(`✅ Created database: ${adminDb.name}`);
        } catch (error) {
            if (error.code === 409) {
                console.log(`ℹ️  Database '${adminDbId}' already exists`);
            } else throw error;
        }

        // Admin collections
        const adminCollections = [
            {
                id: 'admins',
                name: 'Admins',
                attributes: [
                    { name: 'phoneNumber', type: 'string', size: 255, required: true },
                    { name: 'role', type: 'string', size: 50, required: true },
                    { name: 'name', type: 'string', size: 255, required: false },
                    { name: 'addedBy', type: 'string', size: 255, required: false },
                    { name: 'createdAt', type: 'datetime', required: true }
                ]
            },
            {
                id: 'blacklist',
                name: 'Blacklist',
                attributes: [
                    { name: 'phoneNumber', type: 'string', size: 255, required: true },
                    { name: 'reason', type: 'string', size: 500, required: false },
                    { name: 'blacklistedBy', type: 'string', size: 255, required: true },
                    { name: 'blacklistedAt', type: 'datetime', required: true }
                ]
            },
            {
                id: 'user_limits',
                name: 'User Limits',
                attributes: [
                    { name: 'phoneNumber', type: 'string', size: 255, required: true },
                    { name: 'dailyLimit', type: 'integer', required: true, min: 0, max: 10000 },
                    { name: 'updatedAt', type: 'datetime', required: true }
                ]
            },
            {
                id: 'global_settings',
                name: 'Global Settings',
                attributes: [
                    { name: 'key', type: 'string', size: 255, required: true },
                    { name: 'value', type: 'string', size: 5000, required: true },
                    { name: 'updatedAt', type: 'datetime', required: true }
                ]
            },
            {
                id: 'audit_logs',
                name: 'Audit Logs',
                attributes: [
                    { name: 'adminPhone', type: 'string', size: 255, required: true },
                    { name: 'action', type: 'string', size: 255, required: true },
                    { name: 'details', type: 'string', size: 5000, required: false },
                    { name: 'timestamp', type: 'datetime', required: true }
                ]
            },
            {
                id: 'system_logs',
                name: 'System Logs',
                attributes: [
                    { name: 'level', type: 'string', size: 50, required: true },
                    { name: 'message', type: 'string', size: 5000, required: true },
                    { name: 'details', type: 'string', size: 5000, required: false },
                    { name: 'timestamp', type: 'datetime', required: true }
                ]
            },
            {
                id: 'usage_logs',
                name: 'Usage Logs',
                attributes: [
                    { name: 'phoneNumber', type: 'string', size: 255, required: true },
                    { name: 'messageCount', type: 'integer', required: true, min: 0 },
                    { name: 'date', type: 'datetime', required: true }
                ]
            }
        ];

        for (const collection of adminCollections) {
            try {
                await databases.createCollection(
                    adminDbId,
                    collection.id,
                    collection.name,
                    [
                        Permission.read(Role.any()),
                        Permission.create(Role.any()),
                        Permission.update(Role.any()),
                        Permission.delete(Role.any())
                    ]
                );

                // Add attributes
                for (const attr of collection.attributes) {
                    if (attr.type === 'string') {
                        await databases.createStringAttribute(
                            adminDbId, 
                            collection.id, 
                            attr.name, 
                            attr.size, 
                            attr.required
                        );
                    } else if (attr.type === 'integer') {
                        await databases.createIntegerAttribute(
                            adminDbId, 
                            collection.id, 
                            attr.name, 
                            attr.required, 
                            attr.min || null, 
                            attr.max || null
                        );
                    } else if (attr.type === 'datetime') {
                        await databases.createDatetimeAttribute(
                            adminDbId, 
                            collection.id, 
                            attr.name, 
                            attr.required
                        );
                    }
                }

                console.log(`✅ Created collection: ${collection.name}`);
            } catch (error) {
                if (error.code === 409) {
                    console.log(`ℹ️  Collection '${collection.name}' already exists`);
                } else throw error;
            }
        }

        // 5. Create Jarvis-specific database
        const jarvisDbId = 'jarvis_db';
        try {
            const jarvisDb = await databases.create(
                jarvisDbId,
                'Jarvis Services Database'
            );
            console.log(`✅ Created database: ${jarvisDb.name}`);
        } catch (error) {
            if (error.code === 409) {
                console.log(`ℹ️  Database '${jarvisDbId}' already exists`);
            } else throw error;
        }

        // Jarvis collections
        const jarvisCollections = [
            {
                id: 'tickets',
                name: 'Tickets',
                attributes: [
                    { name: 'ticketId', type: 'string', size: 50, required: true },
                    { name: 'title', type: 'string', size: 500, required: true },
                    { name: 'description', type: 'string', size: 5000, required: true },
                    { name: 'priority', type: 'string', size: 50, required: true },
                    { name: 'status', type: 'string', size: 50, required: true },
                    { name: 'assignedTo', type: 'string', size: 255, required: false },
                    { name: 'createdBy', type: 'string', size: 255, required: true },
                    { name: 'createdAt', type: 'datetime', required: true },
                    { name: 'updatedAt', type: 'datetime', required: true }
                ]
            },
            {
                id: 'projects',
                name: 'Projects',
                attributes: [
                    { name: 'name', type: 'string', size: 255, required: true },
                    { name: 'description', type: 'string', size: 5000, required: false },
                    { name: 'status', type: 'string', size: 50, required: true },
                    { name: 'startDate', type: 'datetime', required: false },
                    { name: 'endDate', type: 'datetime', required: false },
                    { name: 'teamMembers', type: 'string', size: 5000, required: false },
                    { name: 'createdBy', type: 'string', size: 255, required: true },
                    { name: 'createdAt', type: 'datetime', required: true }
                ]
            },
            {
                id: 'reminders',
                name: 'Reminders',
                attributes: [
                    { name: 'phoneNumber', type: 'string', size: 255, required: true },
                    { name: 'message', type: 'string', size: 5000, required: true },
                    { name: 'reminderTime', type: 'datetime', required: true },
                    { name: 'recurring', type: 'boolean', required: false },
                    { name: 'recurringPattern', type: 'string', size: 50, required: false },
                    { name: 'sent', type: 'boolean', required: true },
                    { name: 'createdAt', type: 'datetime', required: true }
                ]
            },
            {
                id: 'documents',
                name: 'Documents',
                attributes: [
                    { name: 'phoneNumber', type: 'string', size: 255, required: true },
                    { name: 'fileName', type: 'string', size: 500, required: true },
                    { name: 'fileType', type: 'string', size: 50, required: true },
                    { name: 'fileSize', type: 'integer', required: true, min: 0 },
                    { name: 'content', type: 'string', size: 10000, required: false },
                    { name: 'uploadedAt', type: 'datetime', required: true }
                ]
            }
        ];

        for (const collection of jarvisCollections) {
            try {
                await databases.createCollection(
                    jarvisDbId,
                    collection.id,
                    collection.name,
                    [
                        Permission.read(Role.any()),
                        Permission.create(Role.any()),
                        Permission.update(Role.any()),
                        Permission.delete(Role.any())
                    ]
                );

                // Add attributes
                for (const attr of collection.attributes) {
                    if (attr.type === 'string') {
                        await databases.createStringAttribute(
                            jarvisDbId, 
                            collection.id, 
                            attr.name, 
                            attr.size, 
                            attr.required
                        );
                    } else if (attr.type === 'integer') {
                        await databases.createIntegerAttribute(
                            jarvisDbId, 
                            collection.id, 
                            attr.name, 
                            attr.required, 
                            attr.min || null, 
                            attr.max || null
                        );
                    } else if (attr.type === 'datetime') {
                        await databases.createDatetimeAttribute(
                            jarvisDbId, 
                            collection.id, 
                            attr.name, 
                            attr.required
                        );
                    } else if (attr.type === 'boolean') {
                        await databases.createBooleanAttribute(
                            jarvisDbId, 
                            collection.id, 
                            attr.name, 
                            attr.required
                        );
                    }
                }

                console.log(`✅ Created collection: ${collection.name}`);
            } catch (error) {
                if (error.code === 409) {
                    console.log(`ℹ️  Collection '${collection.name}' already exists`);
                } else throw error;
            }
        }

        console.log('\n✅ Database setup completed successfully!');
        console.log('\n📋 Summary:');
        console.log('- Main database: whatsapp_chatbot_db');
        console.log('- Admin database: jarvis_admin');
        console.log('- Services database: jarvis_db');
        console.log('\nYour WhatsApp bot is now ready to use with the self-hosted Appwrite instance!');

    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        if (error.response) {
            console.error('Response:', error.response);
        }
        process.exit(1);
    }
}

setupDatabases().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});