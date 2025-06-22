// Feature flags configuration
export const featuresConfig = {
  // Core features
  reminders: {
    enabled: false, // TEMPORARILY DISABLED DUE TO APPWRITE 500 ERRORS
    checkInterval: 60000, // 1 minute
  },
  
  // Voice and interaction features (from interaction.config.ts)
  voiceMessages: true,
  messageChunking: true,
  humanSimulation: true,
  
  // Debug and logging
  debug: {
    logAppwriteQueries: false,
    logDetailedErrors: true,
  }
};