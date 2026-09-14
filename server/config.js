require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'production',
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',

  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.6-flash',

  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',

  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_CHAT_MODEL: process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b',
  GROQ_WHISPER_MODEL: process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo',

  NOTION_API_KEY: process.env.NOTION_API_KEY || '',
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID || ''
};
