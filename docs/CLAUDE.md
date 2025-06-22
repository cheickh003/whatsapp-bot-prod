# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

```bash
# Development
npm run dev        # TypeScript dev server with auto-reload
npm run build      # Compile TypeScript to JavaScript  
npm run lint       # ESLint checks
npm run typecheck  # TypeScript type checking

# Production - ALWAYS use bot-manager.sh
./bot-manager.sh start    # Start with PID tracking
./bot-manager.sh stop     # Graceful shutdown  
./bot-manager.sh restart  # Clean restart
./bot-manager.sh status   # Check status
./bot-manager.sh logs     # Follow logs
```

## Architecture Overview

**WhatsApp Bot "Jarvis"** - AI-powered assistant for Nourx (Ivorian digital services company) with ticket management, project tracking, and reminder capabilities.

### Core Service Flow
```
WhatsApp Message → Message Handler → Memory Service → AI Service (GPT-4.0-mini)
                        ↓                  ↓               ↓
                  Command Handler    Appwrite DB     OpenAI API
```

### Key Services

1. **WhatsApp Service** (`whatsapp.service.ts`)
   - Uses LocalAuth with clientId: 'jarvis-bot-nourx' for session persistence
   - Handles QR authentication and reconnection
   - Event-driven architecture with typing simulation

2. **Appwrite Service** (`appwrite.service.ts`)
   - Connection verification is CRITICAL - always check first
   - Auto-creates collections and attributes
   - Handles all database operations with retry logic

3. **Memory Service** (`memory.service.ts`)
   - Loads full conversation history (limited to 20 messages)
   - Messages saved AFTER AI response to maintain proper order
   - Each phone number has unique conversation

4. **AI Service** (`ai.service.ts`)
   - Direct OpenAI API integration (not using LangChain ConversationChain)
   - Sends complete history with each request
   - Jarvis personality: French/English, 150-word responses, professional

### Business Services (Jarvis Features)

- **Ticket Service**: Support tickets with auto-numbering
- **Project Service**: Project management with milestones
- **Reminder Service**: Time-based notifications (checks every minute)
- **Admin Service**: PIN auth, user management, audit logging

## Critical Implementation Notes

### Session Persistence Fix
```bash
# If session not persisting after restart:
1. clientId must match in session.config.ts and whatsapp.config.ts
2. Ensure files owned by correct user (not root)
3. Always graceful shutdown before restart
4. Remove corrupted session: rm -rf .wwebjs_auth/session-*
```

### Appwrite Reminder Service 500 Error
The reminder service has a recurring Appwrite query error. This needs to be fixed by ensuring proper indexes on the `reminders` collection for the query filters being used.

### Message Processing Pattern
```typescript
// Always load context first
const context = await memoryService.loadContext(phoneNumber);
// Add current message to history
const messages = [...context.messageHistory, userMessage];
// Get AI response with full context
const response = await aiService.processMessage(messages);
// Save BOTH messages after response
await memoryService.saveMessages(userMessage, response);
```

### Process Management
- PID tracking prevents zombie processes
- Chrome runs with `--single-process` flag
- Graceful shutdown handlers on all signals
- Emergency cleanup: `./bot-manager.sh clean`

## Admin System

Default credentials:
- Phone: `2250703079410@c.us`
- PIN: `1471` (changed from default 1234)

Key admin commands (authenticate first with `/admin auth PIN`):
- `/admin status` - System metrics
- `/admin users` - Active users
- `/admin block [phone] [reason]` - Block user
- `/admin backup` - Database backup
- `/admin stats` - Usage statistics

## Common Issues & Solutions

### Bot asks for QR code on every restart
- Check clientId consistency
- Fix file ownership: `chown -R user:user .wwebjs_auth/`
- Delete corrupted session and rescan

### Multiple node/chrome processes
- Always use bot-manager.sh (not npm directly)
- Check with `./bot-manager.sh status`
- Clean zombies: `./bot-manager.sh clean`

### Memory not persisting
- Check "Loaded X messages" in logs
- Verify Appwrite connection
- Ensure messages saved after AI response

### Appwrite connection errors
- Verify .env configuration
- Check Appwrite service is running
- Test with `node test/test-appwrite-direct.js`

### Invalid Origin warning
- Not a critical error - bot works anyway
- To fix: Add your IP as Web platform in Appwrite console
- See Docs/APPWRITE_ORIGIN_FIX.md for detailed steps

## Development Workflow

1. **Before starting work**: 
   - `./bot-manager.sh status` to check current state
   - Review bot.log for any errors

2. **Making changes**:
   - Use `npm run dev` for hot reload
   - Run `npm run typecheck` before commits
   - Test admin commands after service changes

3. **Testing session persistence**:
   - Make a change requiring restart
   - Use `./bot-manager.sh restart`
   - Verify no QR code requested

4. **Adding new features**:
   - Create service in `src/services/`
   - Initialize in `index.ts`
   - Add commands to `command.handler.ts`
   - Update system prompt if needed

## Key Files Reference

- `src/config/jarvis.config.ts` - Bot personality and limits
- `src/config/whatsapp.config.ts` - WhatsApp client settings  
- `src/handlers/message.handler.ts` - Main message processing
- `src/services/ai.service.ts` - OpenAI integration and prompts
- `bot-manager.sh` - Process management script
- `.env` - Environment variables (OPENAI_API_KEY required)