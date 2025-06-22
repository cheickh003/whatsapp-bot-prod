#!/bin/bash

echo "Monitoring bot logs for message processing..."
echo "Send a WhatsApp message to test!"
echo ""

tail -f bot.log | grep -E "(Processing message|Loading conversation|Got conversation|Loaded|messages|History|Human|AI|Message received|Message sent)" --line-buffered | while IFS= read -r line; do
    # Color different types of logs
    if [[ $line == *"Message received"* ]]; then
        echo -e "\033[1;33m>>> $line\033[0m"
    elif [[ $line == *"Processing message"* ]]; then
        echo -e "\033[1;36m$line\033[0m"
    elif [[ $line == *"Loading conversation"* ]] || [[ $line == *"Got conversation"* ]]; then
        echo -e "\033[1;32m$line\033[0m"
    elif [[ $line == *"[Human]"* ]] || [[ $line == *"[user]"* ]]; then
        echo -e "\033[0;32m$line\033[0m"
    elif [[ $line == *"[AI]"* ]] || [[ $line == *"[assistant]"* ]]; then
        echo -e "\033[0;34m$line\033[0m"
    elif [[ $line == *"Message sent"* ]]; then
        echo -e "\033[1;35m<<< $line\033[0m"
    else
        echo "$line"
    fi
done