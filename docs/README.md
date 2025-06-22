# WhatsApp Chatbot with Persistent Memory - Jarvis Edition

A WhatsApp chatbot built with TypeScript, LangChain, and Appwrite for persistent conversation memory. This bot has been customized as "Jarvis", an intelligent project assistant for Nourx, providing 24/7 support with ticket management, project tracking, and reminder capabilities.

## Features

### Core Features
- WhatsApp integration using whatsapp-web.js
- AI-powered responses using OpenAI GPT-4.0-mini (as Jarvis)
- Persistent conversation memory stored in Appwrite
- Typing simulation for natural conversation flow
- Multi-language support (French/English)

### Jarvis Capabilities
- **Ticket Management**: Create and track support tickets
- **Project Tracking**: Manage projects with milestones
- **Smart Reminders**: Set time-based and recurring reminders
- **Human Escalation**: Transfer to human agents when needed
- **Business Context**: Aware of Nourx services and expertise

### Command System
- User commands: /help, /ticket, /project, /remind, /human, /clear, /info
- Admin commands: Full admin system with authentication

## Prerequisites

- Node.js 18+ and npm
- Appwrite instance running locally or remotely
- OpenAI API key
- WhatsApp account for the bot

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Update the `.env` file with your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
```

## Running the Bot

### Using Bot Manager (Recommended):
```bash
# Start the bot
./bot-manager.sh start

# Stop the bot
./bot-manager.sh stop

# Restart the bot
./bot-manager.sh restart

# Check status
./bot-manager.sh status

# View logs
./bot-manager.sh logs
```

### Development mode:
```bash
npm run dev
```

### Production mode (direct):
```bash
npm run build
npm start
```

**Note**: Always prefer using `bot-manager.sh` to avoid process accumulation issues. See PROCESS_MANAGEMENT.md for details.

## First Time Setup

1. Run the bot
2. Scan the QR code with your WhatsApp mobile app
3. The bot will automatically create the necessary database and collections in Appwrite
4. Start chatting!

## Available Commands

### User Commands
- `/help` - Show available commands
- `/clear` - Clear conversation history
- `/info` - Show conversation information

### Admin Commands
The bot includes a comprehensive admin system. Default admin credentials:
- Phone: `2250703079410@c.us`
- PIN: `1234` (PLEASE CHANGE THIS!)

To use admin commands:
1. First authenticate: `/admin auth 1234`
2. Then use any admin command (session expires after 15 minutes)

Key admin commands:
- `/admin status` - System status and metrics
- `/admin users` - List active users
- `/admin block [phone] [reason]` - Block a user
- `/admin backup` - Create database backup
- `/admin stats` - Usage statistics
- `/admin help` - Full admin command list

See CLAUDE.md for complete admin documentation.

## Project Structure

- `src/config/` - Configuration files for services
- `src/services/` - Core services (Appwrite, WhatsApp, AI, Memory)
- `src/handlers/` - Message and command handlers
- `src/models/` - TypeScript interfaces and models
- `src/utils/` - Utility functions and logger
- `src/types/` - Type definitions

## Important Notes

- The bot requires Appwrite to be running and accessible
- Conversations are stored per phone number
- Message history is limited to 20 messages by default
- The bot ignores group messages