#!/bin/bash

BOT_NAME="whatsapp-chatbot"
LOG_FILE="bot.log"
PID_FILE="bot.pid"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if bot is already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Bot is already running with PID: $PID${NC}"
        echo "Use ./stop.sh to stop it first"
        exit 1
    else
        echo -e "${YELLOW}Removing stale PID file${NC}"
        rm "$PID_FILE"
    fi
fi

echo -e "${GREEN}Starting WhatsApp Bot...${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Build TypeScript
echo -e "${YELLOW}Building TypeScript...${NC}"
npm run build

# Start the bot in background
nohup npm start > "$LOG_FILE" 2>&1 &
PID=$!

# Save PID
echo $PID > "$PID_FILE"

# Wait a bit to check if the process started successfully
sleep 3

if ps -p $PID > /dev/null 2>&1; then
    echo -e "${GREEN}Bot started successfully!${NC}"
    echo -e "PID: $PID"
    echo -e "Log file: $LOG_FILE"
    echo -e ""
    echo -e "Commands:"
    echo -e "  View logs: tail -f $LOG_FILE"
    echo -e "  Stop bot: ./stop.sh"
    echo -e "  Check status: ./status.sh"
else
    echo -e "${RED}Failed to start bot. Check $LOG_FILE for errors${NC}"
    rm "$PID_FILE"
    exit 1
fi