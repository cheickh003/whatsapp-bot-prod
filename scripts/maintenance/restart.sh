#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Restarting WhatsApp Bot...${NC}"

# Stop the bot if running
./stop.sh

# Wait a bit
sleep 2

# Start the bot
./start.sh