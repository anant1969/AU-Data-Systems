
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResponse, Language, UserProfile, Message } from "../types";
import { decodeBase64 } from "../utils/audioUtils";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Translates text and generates suggested responses using Gemini 2.5 Flash.
 * Uses UserProfile to personalize the output (Learning/Personalization).
 * Supports Multimodal Input (Text + Image) for Facial Expression Analysis.
 */
export const translateContent = async (
  text: string,
  sourceLang: Language,
  targetLang: Language,
  userProfile: UserProfile | null,
  history: Message[],
  imageContext?: string // Base64 Image string for facial analysis
): Promise<TranslationResponse> => {
  
  // Construct a personalized system instruction based on the user profile
  // This enables the "Machine Learning" aspect by providing context for in-context learning.
  let profileContext = "";
  if (userProfile) {
    const toneString = userProfile.tone.join(', ');
    const interestsString = userProfile.conversationTypes.join(', ');

    profileContext = `
    USER PROFILE CONTEXT:
    - Name: ${userProfile.name}
    - Communication Style: ${toneString}
    - Interests/Context: ${interestsString}
    - Bio: ${userProfile.bio}
    `;
  }

  // Summarize recent history for context
  const recentHistory = history.slice(-3).map(m => 
    `${m.sender === 'user' ? 'User' : 'Partner'}: ${m.originalText}`
  ).join('\n');

  const systemInstruction = `You are an expert real-time translator assistant with computer vision capabilities.
  ${profileContext}

  TASK:
  1. Translate the input text from ${sourceLang.name} to ${targetLang.name}.
  2. If an IMAGE is provided, perform FACIAL EXPRESSION ANALYSIS (Simulate CNN feature extraction).
     - Detect the emotion (e.g., Happy, Angry, Sad, Neutral, Surprised, Confused).
     - Use this emotion to contextualize the translation. (e.g., if face is 'Angry', the translation should reflect a sterner tone).
  3. Provide 3 short, natural, and contextually appropriate responses.
  
  RECENT CONVERSATION HISTORY:
  ${recentHistory}
  `;

  // Prepare contents. If image exists, it's a multimodal request.
  let contents: any = text;
  if (imageContext) {
    contents = {
      parts: [
        { text: text },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageContext
          }
        }
      ]
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translatedText: {
            type: Type.STRING,
            description: `The text translated into ${targetLang.name}, nuanced by the facial expression.`
          },
          detectedEmotion: {
            type: Type.STRING,
            description: "The detected facial emotion (e.g., 'Joyful', 'Frustrated', 'Neutral'). If no image, infer from text."
          },
          suggestedResponses: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: `3 suggested short responses in ${targetLang.name}`
          }
        },
        required: ["translatedText", "suggestedResponses", "detectedEmotion"]
      }
    }
  });

  const result = response.text;
  if (!result) throw new Error("No translation returned");
  
  try {
      return JSON.parse(result) as TranslationResponse;
  } catch (e) {
      console.error("Failed to parse Gemini JSON response", result);
      // Fallback if JSON is broken but some text exists
      return {
          translatedText: result.replace(/[{}]/g, '').slice(0, 100) + "...", 
          detectedEmotion: "Neutral",
          suggestedResponses: ["Could you repeat that?", "I understand.", "Thank you."]
      };
  }
};

/**
 * Generates speech audio from text using Gemini 2.5 Flash TTS.
 */
export const generateSpeech = async (
  text: string,
  voiceName: string
): Promise<Uint8Array> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName }
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!base64Audio) {
    throw new Error("No audio data returned from Gemini");
  }

  return decodeBase64(base64Audio);
};

/**
 * Generates an automated response acting AS the user when they are unavailable.
 */
export const generateAvatarReply = async (
  incomingText: string,
  userProfile: UserProfile,
  history: Message[]
): Promise<string> => {
  const toneString = userProfile.tone.join(', ');
  
  const systemInstruction = `
    You are an AI Digital Avatar acting on behalf of ${userProfile.name}.
    ${userProfile.name} is currently unavailable/busy and cannot answer the call/message directly.
    
    YOUR PROFILE:
    - Name: ${userProfile.name}
    - Tone: ${toneString}
    - Bio: ${userProfile.bio}
    - Interests: ${userProfile.conversationTypes.join(', ')}

    YOUR TASK:
    1. Read the incoming message from the Partner.
    2. Generate a response in ${userProfile.primaryLanguage} (Language Code: ${userProfile.primaryLanguage}) acting AS ${userProfile.name}.
    3. Explain briefly that you are their AI assistant if the context implies urgency, otherwise just handle the conversation naturally based on the bio.
    4. Keep it concise (under 2 sentences).
  `;

  // Provide recent context
  const historyText = history.slice(-5).map(m => 
    `${m.sender === 'user' ? 'Me' : 'Partner'}: ${m.originalText}`
  ).join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `HISTORY:\n${historyText}\n\nINCOMING MESSAGE:\n${incomingText}`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
           replyText: { type: Type.STRING, description: "The response text acting as the user." }
        }
      }
    }
  });

  try {
     const json = JSON.parse(response.text || "{}");
     return json.replyText || "I am currently unavailable.";
  } catch (e) {
     return response.text || "I am currently unavailable.";
  }
}
