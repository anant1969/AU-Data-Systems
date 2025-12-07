import { Language } from './types';

// Voice names mapped to Gemini TTS preview voices: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English', flag: '🇺🇸', voiceName: 'Puck' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸', voiceName: 'Kore' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷', voiceName: 'Charon' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪', voiceName: 'Fenrir' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹', voiceName: 'Zephyr' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵', voiceName: 'Kore' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷', voiceName: 'Puck' },
  { code: 'zh-CN', name: 'Chinese', flag: '🇨🇳', voiceName: 'Charon' },
  { code: 'pt-BR', name: 'Portuguese', flag: '🇧🇷', voiceName: 'Fenrir' },
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳', voiceName: 'Zephyr' },
];

export const AUDIO_SAMPLE_RATE = 24000;

export const CONVERSATION_TOPICS = [
  "Casual Chat",
  "Business / Professional",
  "Medical / Emergency",
  "Academic / Learning",
  "Shopping",
  "Travel",
  "Spirituality",
  "Emotional Well-being",
  "Research",
  "Ideation",
  "Financing",
  "Help / Support",
  "Conflict Resolution",
  "Negotiation",
  "Relationship"
];

export const TONE_PREFERENCES = [
  "Casual",
  "Formal",
  "Friendly",
  "Professional",
  "Emotional",
  "Polite",
  "Respectful",
  "Persuasive",
  "Influential",
  "Supportive",
  "Caring",
  "Intellectual",
  "Cognitive",
  "Teaching",
  "Preaching",
  "Creative",
  "Neutral"
];