#!/bin/bash

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}This will delete the WhatsApp bot database and collections in Appwrite.${NC}"
echo -e "${RED}This action cannot be undone!${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo -e "${YELLOW}Cleaning database...${NC}"

# Run a simple Node.js script to clean the database
node -e "
const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const databaseId = process.env.DATABASE_ID || 'whatsapp_chatbot_db';

async function cleanDatabase() {
  try {
    await databases.delete(databaseId);
    console.log('Database deleted successfully');
  } catch (error) {
    if (error.code === 404) {
      console.log('Database does not exist');
    } else {
      console.error('Error:', error.message);
    }
  }
}

cleanDatabase();
"

echo -e "${GREEN}Database cleaned. The bot will recreate it on next start.${NC}"