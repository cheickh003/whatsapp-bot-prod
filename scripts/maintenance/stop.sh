#!/bin/bash

PID_FILE="bot.pid"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}Bot is not running (PID file not found)${NC}"
    exit 0
fi

PID=$(cat "$PID_FILE")

if ps -p $PID > /dev/null 2>&1; then
    echo -e "${YELLOW}Stopping WhatsApp Bot (PID: $PID)...${NC}"
    kill $PID
    
    # Wait for process to stop
    sleep 2
    
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Process still running, forcing stop...${NC}"
        kill -9 $PID
    fi
    
    rm "$PID_FILE"
    echo -e "${GREEN}Bot stopped successfully${NC}"
else
    echo -e "${YELLOW}Bot is not running (process not found)${NC}"
    rm "$PID_FILE"
fi