# Voice Messages and Message Chunking Implementation

## Overview

This document describes the implementation of two major features:
1. **Voice Message Processing**: Automatic transcription of WhatsApp voice messages using OpenAI's Whisper API
2. **Message Chunking**: Splitting long AI responses into multiple shorter messages with human-like delays

## Features Implemented

### 1. Voice Message Processing

- **Automatic Detection**: Voice messages (PTT - Push To Talk) are automatically detected and processed
- **Asynchronous Processing**: Voice messages are processed in the background without blocking other messages
- **Transparent Transcription**: Users don't see the transcription - the bot responds directly to the content
- **Error Handling**: Silent error handling to avoid confusing users with technical errors

#### Key Components:
- `voice.service.ts`: Handles voice message downloading, transcription, and processing
- `audio.utils.ts`: Utility functions for audio file management
- Updated `message.model.ts` with `MessageType` enum and voice-related fields

### 2. Message Chunking with Human Simulation

- **Smart Splitting**: Long messages are split into chunks of 3-4 lines maximum
- **Natural Break Points**: Splits occur at punctuation marks (. ! ? , ;) when possible
- **Typing Simulation**: Shows "typing..." indicator between chunks
- **Variable Delays**: 
  - Reading delay before first response
  - Typing delay based on message length
  - Pause between chunks (1-3 seconds)
  - Random variation for more natural feel

#### Key Components:
- `message-formatter.service.ts`: Handles message splitting and delay calculations
- Updated `whatsapp.service.ts` with `sendMessageWithChunks()` method
- `interaction.config.ts`: Centralized configuration for all timing and behavior

## Configuration

All features can be configured in `src/config/interaction.config.ts`:

```typescript
{
  voiceProcessing: {
    enabled: true,
    maxFileSize: 10MB,
    transcriptionTimeout: 30s,
    whisperModel: 'whisper-1'
  },
  messageChunking: {
    enabled: true,
    maxLinesPerChunk: 4,
    maxCharsPerChunk: 500
  },
  humanSimulation: {
    typing: { baseDelay: 1500ms },
    reading: { perWordDelay: 150ms },
    chunkDelays: { afterShortMessage: 1000ms }
  }
}
```

## Usage

### Voice Messages
1. User sends a voice message
2. Bot automatically transcribes it using Whisper
3. Bot processes the transcription as regular text
4. Bot responds naturally without mentioning it was a voice message

### Message Chunking
All AI responses are automatically chunked if enabled. No code changes needed - the system intercepts `sendMessage` calls and applies chunking when appropriate.

## Dependencies Added

- `axios`: For making HTTP requests to OpenAI Whisper API
- `form-data`: For sending audio files as multipart form data

## Testing Recommendations

1. **Voice Messages**:
   - Test with different audio formats (OGG, MP3)
   - Test with different languages
   - Test error scenarios (corrupted audio, network issues)

2. **Message Chunking**:
   - Test with very long responses
   - Test with responses containing code or special formatting
   - Verify typing indicators appear correctly

## Environment Variables

Optional new environment variable:
- `WHISPER_LANGUAGE`: Set to force a specific language (e.g., 'fr', 'en'). Default is 'auto'

## Performance Considerations

- Voice processing happens asynchronously to avoid blocking
- Temporary audio files are automatically cleaned up
- Queue system prevents multiple voice messages from same user being processed simultaneously
- Maximum file size limit prevents memory issues

## Future Enhancements

1. Support for voice responses (Text-to-Speech)
2. Voice message caching to avoid re-transcription
3. Advanced chunking strategies based on message content type
4. Customizable per-user delay preferences