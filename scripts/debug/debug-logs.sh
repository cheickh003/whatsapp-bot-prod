#!/bin/bash

# Script to show colored logs for debugging

echo "Showing debug logs (Ctrl+C to stop)..."
echo ""

tail -f bot.log | while read line; do
    if [[ $line == *"[error]"* ]]; then
        echo -e "\033[0;31m$line\033[0m"  # Red for errors
    elif [[ $line == *"Processing message with"* ]] || [[ $line == *"Loaded"* ]] || [[ $line == *"messages in history"* ]]; then
        echo -e "\033[0;36m$line\033[0m"  # Cyan for memory/history logs
    elif [[ $line == *"[Human]"* ]] || [[ $line == *"[user]"* ]]; then
        echo -e "\033[0;32m$line\033[0m"  # Green for human messages
    elif [[ $line == *"[AI]"* ]] || [[ $line == *"[assistant]"* ]]; then
        echo -e "\033[0;34m$line\033[0m"  # Blue for AI messages
    elif [[ $line == *"Message received"* ]] || [[ $line == *"Message sent"* ]]; then
        echo -e "\033[0;33m$line\033[0m"  # Yellow for WhatsApp events
    else
        echo "$line"
    fi
done