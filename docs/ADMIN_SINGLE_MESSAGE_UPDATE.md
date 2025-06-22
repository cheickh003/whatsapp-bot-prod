# Admin Single Message Update

## Change Applied
Les messages envoyés aux administrateurs ne seront plus découpés en chunks. Ils seront envoyés en un seul message, peu importe leur longueur.

## Files Modified
1. **src/handlers/message.handler.ts**
   - Modified command response handling to check if user is admin
   - Modified AI response handling to check if user is admin
   - Admins now bypass message chunking

2. **src/services/voice.service.ts**
   - Modified voice message response handling
   - Admins receive voice transcription responses in one piece

## Behavior
- **Regular users**: Continue to receive messages in chunks with typing simulation
- **Admins**: Receive all messages instantly in one piece
- The check is done using `isAdmin` variable which is already available in the context

## To Test
1. Send a long message as an admin user
2. Send a long message as a regular user
3. Verify admins get instant full messages
4. Verify regular users still get chunked messages with delays