export const interactionConfig = {
  // Voice message processing configuration
  voiceProcessing: {
    enabled: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxDuration: 300, // 5 minutes in seconds
    transcriptionTimeout: 30000, // 30 seconds
    supportedFormats: ['audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/mp4'],
    tempDirectory: '/tmp/voice-messages',
    whisperModel: 'whisper-1',
    language: 'auto', // auto-detect or specify 'fr', 'en', etc.
  },

  // Message chunking configuration
  messageChunking: {
    enabled: true,
    maxLinesPerChunk: 4,
    minLinesPerChunk: 1,
    maxCharsPerChunk: 500,
    minCharsPerChunk: 50,
    preferredBreakPoints: [
      '. ',   // End of sentence
      '! ',   // Exclamation
      '? ',   // Question
      '\n\n', // Paragraph break
      '\n',   // Line break
      ', ',   // Comma
      '; ',   // Semicolon
      ': ',   // Colon
    ],
  },

  // Human simulation timing
  humanSimulation: {
    // Typing simulation
    typing: {
      baseDelay: 1500, // Base delay in ms
      perWordDelay: 200, // Additional delay per word
      perCharDelay: 0, // Can add per-character delay if needed
      punctuationDelay: 300, // Extra delay for punctuation
      variationPercent: 20, // ±20% random variation
    },

    // Reading simulation (before typing)
    reading: {
      enabled: true,
      baseDelay: 500, // Minimum reading time
      perWordDelay: 150, // Time to "read" each word
      maxDelay: 2000, // Maximum reading time
    },

    // Delays between message chunks
    chunkDelays: {
      afterShortMessage: 1000, // After 1-2 lines
      afterMediumMessage: 2000, // After 3-4 lines
      afterLongMessage: 3000, // After 5+ lines
      afterPunctuation: {
        period: 500,
        comma: 200,
        exclamation: 600,
        question: 700,
      },
    },

    // Typing indicator behavior
    typingIndicator: {
      showBetweenChunks: true,
      minDuration: 1000,
      persistAfterSending: 200, // Keep typing indicator briefly after sending
    },
  },

  // Queue management for concurrent messages
  queueManagement: {
    maxConcurrentVoiceProcessing: 3,
    voiceQueueTimeout: 60000, // 1 minute
    prioritizeTextOverVoice: true,
    maxQueueSize: 50,
  },

  // Error handling
  errorHandling: {
    silentVoiceErrors: true, // Don't notify user of voice processing errors
    voiceErrorFallback: "Je n'ai pas pu comprendre ce message",
    maxRetries: 2,
    retryDelay: 1000,
  },

  // Feature flags
  features: {
    voiceMessages: true,
    messageChunking: true,
    humanSimulation: true,
    debugMode: false, // Set to true for detailed logging
  },
};