
import React, { useState, useEffect } from 'react';
import { Message, OutputPreference } from '../types';

interface ChatMessageProps {
  message: Message;
  preference: OutputPreference;
  onPlayAudio: (buffer: ArrayBuffer) => void;
  onSelectSuggestion: (text: string) => void;
  isLatest: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  preference,
  onPlayAudio, 
  isLatest 
}) => {
  const isUser = message.sender === 'user';
  const showTranslated = preference === OutputPreference.TRANSLATED;
  
  // Determine what text to show based on preference
  const mainText = showTranslated ? message.translatedText : message.originalText;
  const subText = showTranslated ? message.originalText : message.translatedText;
  const langLabel = showTranslated ? message.targetLang.split('-')[0] : message.originalLang.split('-')[0];

  const handlePlayAudio = () => {
    if (showTranslated && message.translatedAudioBuffer) {
      onPlayAudio(message.translatedAudioBuffer);
    } else if (!showTranslated && message.originalAudioBlob) {
      // Create a temporary URL for the blob and play it
      const url = URL.createObjectURL(message.originalAudioBlob);
      const audio = new Audio(url);
      audio.play();
    }
  };

  const hasAudioSource = showTranslated ? !!message.translatedAudioBuffer : !!message.originalAudioBlob;

  // Determine Emotion Color
  const getEmotionColor = (emotion?: string) => {
     if (!emotion) return 'border-transparent';
     const e = emotion.toLowerCase();
     if (e.includes('happy') || e.includes('joy')) return 'border-yellow-400';
     if (e.includes('angry') || e.includes('frustrated')) return 'border-red-400';
     if (e.includes('sad')) return 'border-blue-400';
     if (e.includes('surprise')) return 'border-purple-400';
     return 'border-gray-200';
  };

  const emotionBorder = getEmotionColor(message.detectedEmotion);

  return (
    <div className={`flex flex-col w-full mb-8 ${isUser ? 'items-end' : 'items-start'}`}>
      <div 
        className={`relative max-w-[85%] md:max-w-[70%] rounded-3xl overflow-hidden shadow-sm transition-all border-2
        ${isUser 
          ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-none shadow-indigo-200 border-indigo-600' 
          : `bg-white text-gray-800 rounded-bl-none shadow-gray-200 ${emotionBorder}`
        }`}
      >
        {/* Video Player if applicable */}
        {(message.type === 'video_file' || message.type === 'video_live') && message.videoBlob && (
          <div className="w-full aspect-video bg-black">
            <video 
              src={URL.createObjectURL(message.videoBlob)} 
              controls={!showTranslated} // Native controls if watching original
              className="w-full h-full object-cover"
              muted={showTranslated} // Mute original video if we want to hear translated TTS
            />
          </div>
        )}
        
        {/* Badges Row */}
        <div className="flex gap-2 absolute top-2 right-2 z-10 pointer-events-none">
          {message.isAutoReply && (
            <div className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider backdrop-blur-sm rounded">
              🤖 AI Avatar
            </div>
          )}
          
          {message.detectedEmotion && !isUser && (
            <div className="bg-white/90 text-gray-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded shadow-sm border border-gray-200 flex items-center gap-1">
               <span>👁️</span> {message.detectedEmotion}
            </div>
          )}
        </div>

        <div className="p-5">
          {/* Sub Text (The "Other" Version) */}
          <div className={`text-xs mb-2 font-medium flex items-center gap-1 ${isUser ? 'text-indigo-200' : 'text-gray-400'}`}>
            <span className="uppercase tracking-wider opacity-70">{langLabel}</span>
            <span>•</span>
            <span className="italic opacity-90 truncate max-w-[200px]">{subText}</span>
          </div>
          
          {/* Main Text */}
          <div className="text-xl font-bold leading-relaxed tracking-tight break-words">
            {mainText}
          </div>

          {/* Audio/Playback Control */}
          {hasAudioSource && (
            <button
              onClick={handlePlayAudio}
              className={`mt-4 flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full transition-all active:scale-95
                ${isUser 
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10' 
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-100'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.805l-.752 2.498a5.791 5.791 0 0 0-.213 1.258c0 .96.333 1.912.953 2.67.657.808 1.636 1.269 2.66 1.269h1.943l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06c1.5 1.5 1.5 3.94 0 5.44a.75.75 0 0 0 1.06 1.06c2.086-2.086 2.086-5.474 0-7.56Z" />
                <path d="M19.9 7.1a.75.75 0 1 0-1.06 1.06c2.671 2.672 2.671 7.008 0 9.68a.75.75 0 1 0 1.06 1.06c3.256-3.256 3.256-8.544 0-11.8Z" />
              </svg>
              {showTranslated ? 'LISTEN (TRANSLATED)' : 'LISTEN (ORIGINAL)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
