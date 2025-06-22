#!/bin/bash

# Bot WhatsApp Manager Script

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )/../.."
PID_FILE="$SCRIPT_DIR/.bot.pid"
LOG_FILE="$SCRIPT_DIR/logs/bot.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function start_bot() {
    echo -e "${YELLOW}Starting WhatsApp Bot...${NC}"
    
    # Check if bot is already running
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${RED}Bot is already running with PID $PID${NC}"
            return 1
        fi
    fi
    
    # Clean up any zombie processes first
    cleanup_processes
    
    # Clear log file
    > "$LOG_FILE"
    
    # Start the bot in background
    cd "$SCRIPT_DIR"
    nohup npm start >> "$LOG_FILE" 2>&1 &
    BOT_PID=$!
    
    # Save PID
    echo $BOT_PID > "$PID_FILE"
    
    echo -e "${GREEN}Bot started with PID $BOT_PID${NC}"
    echo -e "${GREEN}Logs: tail -f $LOG_FILE${NC}"
    
    # Wait a bit and check if it's still running
    sleep 3
    if ps -p $BOT_PID > /dev/null 2>&1; then
        echo -e "${GREEN}Bot is running successfully!${NC}"
    else
        echo -e "${RED}Bot failed to start. Check logs: $LOG_FILE${NC}"
        rm -f "$PID_FILE"
        return 1
    fi
}

function stop_bot() {
    echo -e "${YELLOW}Stopping WhatsApp Bot...${NC}"
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        
        # Try graceful shutdown first
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Sending SIGTERM to PID $PID...${NC}"
            kill -TERM $PID 2>/dev/null
            
            # Wait up to 10 seconds for graceful shutdown
            for i in {1..10}; do
                if ! ps -p $PID > /dev/null 2>&1; then
                    echo -e "${GREEN}Bot stopped gracefully${NC}"
                    break
                fi
                sleep 1
            done
            
            # Force kill if still running
            if ps -p $PID > /dev/null 2>&1; then
                echo -e "${YELLOW}Force killing PID $PID...${NC}"
                kill -9 $PID 2>/dev/null
            fi
        fi
        
        rm -f "$PID_FILE"
    fi
    
    # Clean up any remaining processes
    cleanup_processes
    
    echo -e "${GREEN}Bot stopped${NC}"
}

function cleanup_processes() {
    echo -e "${YELLOW}Cleaning up processes...${NC}"
    
    # Kill any node processes running our bot
    pkill -f "node.*whatsapp" 2>/dev/null
    pkill -f "node dist/index.js" 2>/dev/null
    
    # Kill chromium/chrome processes
    pkill -f "chromium.*whatsapp" 2>/dev/null
    pkill -f "chrome.*whatsapp" 2>/dev/null
    
    # DO NOT clean auth directory - we want to preserve the session!
    # Only clean temporary/cache files if needed
    if [ -d "$SCRIPT_DIR/.wwebjs_cache" ]; then
        echo -e "${YELLOW}Cleaning cache directory...${NC}"
        rm -rf "$SCRIPT_DIR/.wwebjs_cache"
    fi
    
    sleep 1
}

function restart_bot() {
    stop_bot
    sleep 2
    start_bot
}

function status_bot() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${GREEN}Bot is running with PID $PID${NC}"
            
            # Show memory usage
            ps -p $PID -o pid,vsz,rss,comm | tail -n 1
            
            # Show related processes
            echo -e "\n${YELLOW}Related processes:${NC}"
            ps aux | grep -E "(node.*whatsapp|chrome.*whatsapp)" | grep -v grep
            
            # Show last few log lines
            echo -e "\n${YELLOW}Recent logs:${NC}"
            tail -n 10 "$LOG_FILE"
        else
            echo -e "${RED}Bot is not running (stale PID file)${NC}"
            rm -f "$PID_FILE"
        fi
    else
        echo -e "${RED}Bot is not running${NC}"
    fi
}

function logs_bot() {
    if [ -f "$LOG_FILE" ]; then
        # Check if we have additional parameters
        if [ "$2" == "--qr" ]; then
            # Show QR code in a cleaner way
            echo -e "${YELLOW}Looking for QR code in logs...${NC}"
            grep -A 30 "QR Code received" "$LOG_FILE" | tail -n 31 | sed 's/\[32minfo\[39m://' | sed 's/{"timestamp":".*"}//'
        elif [ "$2" == "--lines" ] && [ -n "$3" ]; then
            # Show specific number of lines
            tail -n "$3" "$LOG_FILE"
        else
            # Default: follow logs
            tail -f "$LOG_FILE"
        fi
    else
        echo -e "${RED}Log file not found${NC}"
    fi
}

function clean_all() {
    echo -e "${YELLOW}Performing deep clean...${NC}"
    
    stop_bot
    
    # Kill ALL node and chrome processes (use with caution!)
    echo -e "${YELLOW}Killing all node and chrome processes...${NC}"
    killall -9 node chromium chrome 2>/dev/null
    
    # Ask for confirmation before deleting session
    echo -e "${RED}WARNING: This will delete the WhatsApp session!${NC}"
    echo -e "${YELLOW}You will need to scan the QR code again.${NC}"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Clean up directories including auth
        rm -rf "$SCRIPT_DIR/.wwebjs_auth"
        echo -e "${YELLOW}WhatsApp session deleted${NC}"
    else
        echo -e "${GREEN}Session preserved${NC}"
    fi
    
    rm -f "$PID_FILE"
    
    echo -e "${GREEN}Deep clean completed${NC}"
}

# Main script logic
case "$1" in
    start)
        start_bot
        ;;
    stop)
        stop_bot
        ;;
    restart)
        restart_bot
        ;;
    status)
        status_bot
        ;;
    logs)
        logs_bot
        ;;
    clean)
        clean_all
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|clean}"
        echo ""
        echo "Commands:"
        echo "  start        - Start the bot"
        echo "  stop         - Stop the bot gracefully"
        echo "  restart      - Restart the bot"
        echo "  status       - Show bot status and processes"
        echo "  logs         - Follow bot logs"
        echo "  logs --qr    - Show QR code from logs"
        echo "  logs --lines N - Show last N lines"
        echo "  clean        - Deep clean (kills ALL node/chrome processes)"
        exit 1
        ;;
esac

exit 0