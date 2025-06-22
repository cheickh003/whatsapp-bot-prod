import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined in environment variables');
}

export const openAIConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 1000,
  // Whisper configuration for voice transcription
  whisper: {
    model: 'whisper-1',
    language: process.env.WHISPER_LANGUAGE || 'auto', // 'auto' for auto-detection, or specify 'fr', 'en', etc.
    temperature: 0.2, // Lower temperature for more accurate transcription
    responseFormat: 'json', // Can be 'json', 'text', 'srt', 'verbose_json', or 'vtt'
  },
};