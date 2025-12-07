
export interface Language {
  code: string;
  name: string;
  flag: string;
  voiceName: string; // Mapping for Gemini TTS voices
}

export interface UserProfile {
  name: string;
  primaryLanguage: string; // Language Code
  conversationTypes: string[]; // e.g., 'Business', 'Casual', 'Travel'
  tone: string[]; // Changed from string to string[] to support multiple tones
  bio: string; // "I am a software engineer traveling to Japan"
}

export type MessageType = 'text' | 'audio_live' | 'video_live' | 'audio_file' | 'video_file';

export interface Message {
  id: string;
  type: MessageType;
  originalText: string;
  translatedText: string;
  originalLang: string;
  targetLang: string;
  sender: 'user' | 'partner';
  timestamp: number;
  suggestedResponses?: string[];
  isAutoReply?: boolean; // New flag for AI Avatar responses
  detectedEmotion?: string; // Analysis from Facial Expression (CNN/Vision)
  
  // Audio Content
  originalAudioBlob?: Blob; // The sender's original voice/video audio
  translatedAudioBuffer?: ArrayBuffer; // The AI generated audio
  
  // Video Content
  videoBlob?: Blob; // For recorded video messages
}

export interface TranslationResponse {
  translatedText: string;
  suggestedResponses: string[];
  detectedEmotion?: string;
}

export enum AppState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING', // Live Audio/Video
  RECORDING = 'RECORDING', // Recording File
  TRANSLATING = 'TRANSLATING',
  ERROR = 'ERROR'
}

export enum CommMode {
  TEXT = 'TEXT',
  LIVE_AUDIO = 'LIVE_AUDIO',
  LIVE_VIDEO = 'LIVE_VIDEO',
  REC_AUDIO = 'REC_AUDIO',
  REC_VIDEO = 'REC_VIDEO'
}

export enum OutputPreference {
  TRANSLATED = 'TRANSLATED', // Hear/See in my language
  ORIGINAL = 'ORIGINAL'      // Hear/See in sender's language
}
