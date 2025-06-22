#!/bin/bash

PID_FILE="bot.pid"
LOG_FILE="bot.log"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== WhatsApp Bot Status ===${NC}"
echo ""

if [ ! -f "$PID_FILE" ]; then
    echo -e "${RED}Status: Not running${NC}"
    echo -e "PID file not found"
else
    PID=$(cat "$PID_FILE")
    
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${GREEN}Status: Running${NC}"
        echo -e "PID: $PID"
        
        # Get process info
        PROCESS_INFO=$(ps -p $PID -o pid,vsz,rss,pcpu,pmem,etime,comm | tail -n 1)
        echo -e "Process info: $PROCESS_INFO"
        
        # Show last few log lines
        if [ -f "$LOG_FILE" ]; then
            echo ""
            echo -e "${BLUE}Last 10 log entries:${NC}"
            tail -n 10 "$LOG_FILE"
        fi
    else
        echo -e "${RED}Status: Not running${NC}"
        echo -e "PID file exists but process not found (stale PID: $PID)"
        echo -e "Run ./start.sh to restart the bot"
    fi
fi

echo ""
echo -e "${BLUE}Available commands:${NC}"
echo -e "  ./start.sh  - Start the bot"
echo -e "  ./stop.sh   - Stop the bot"
echo -e "  tail -f $LOG_FILE - View live logs"