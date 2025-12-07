
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Language, Message, AppState, CommMode, OutputPreference, MessageType, UserProfile } from './types';
import { SUPPORTED_LANGUAGES, AUDIO_SAMPLE_RATE } from './constants';
import { translateContent, generateSpeech, generateAvatarReply } from './services/geminiService';
import { getAudioContext, decodeAudioData } from './utils/audioUtils';
import { triggerHaptic } from './utils/hapticUtils'; // Import Haptic Utils
import { LanguageSelector } from './components/LanguageSelector';
import { ChatMessage } from './components/ChatMessage';
import { ProfileSetup } from './components/ProfileSetup';

// Web Speech API Type Definition
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const App: React.FC = () => {
  // --- STATE ---
  const [langA, setLangA] = useState<Language>(SUPPORTED_LANGUAGES[0]); // User
  const [langB, setLangB] = useState<Language>(SUPPORTED_LANGUAGES[1]); // Partner
  const [messages, setMessages] = useState<Message[]>([]);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [commMode, setCommMode] = useState<CommMode>(CommMode.LIVE_AUDIO);
  const [preference, setPreference] = useState<OutputPreference>(OutputPreference.TRANSLATED);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Profile State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  
  // AI Avatar / Auto-Responder State
  const [isAiResponderActive, setIsAiResponderActive] = useState(false);
  
  // Smart Assist / Suggestions
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  
  // Live State
  const [recordingWho, setRecordingWho] = useState<'user' | 'partner' | null>(null);
  const [interimText, setInterimText] = useState<string>('');
  
  // Input State
  const [textInput, setTextInput] = useState('');
  const [isMediaRecording, setIsMediaRecording] = useState(false);
  const [mediaTimer, setMediaTimer] = useState(0);

  // --- REFS ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null); // For Live Video Preview
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Canvas for frame capture
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  // --- EFFECTS ---

  // Load Profile on Mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('omniTalk_userProfile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        // Migration for legacy profiles where tone was a string
        if (typeof parsed.tone === 'string') {
          parsed.tone = [parsed.tone];
        }
        setUserProfile(parsed);
        // Also set the user's language preference if valid
        const userLang = SUPPORTED_LANGUAGES.find(l => l.code === parsed.primaryLanguage);
        if (userLang) setLangA(userLang);
      } catch (e) {
        console.error("Failed to parse profile", e);
        setShowProfileSetup(true);
      }
    } else {
      setShowProfileSetup(true);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, appState]);

  // Timer for media recording
  useEffect(() => {
    let interval: any;
    if (isMediaRecording) {
      interval = setInterval(() => setMediaTimer(prev => prev + 1), 1000);
    } else {
      setMediaTimer(0);
    }
    return () => clearInterval(interval);
  }, [isMediaRecording]);

  // Manage Live Video Camera Feed
  useEffect(() => {
    const startCamera = async () => {
      if ((commMode === CommMode.LIVE_VIDEO || commMode === CommMode.REC_VIDEO) && videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          videoRef.current.srcObject = stream;
        } catch (e) {
          console.error("Camera access denied", e);
        }
      }
    };
    const stopCamera = () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    };

    startCamera();
    return stopCamera;
  }, [commMode]);

  // --- HELPERS ---

  const saveProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('omniTalk_userProfile', JSON.stringify(profile));
    setShowProfileSetup(false);
    triggerHaptic('success');
    
    // Update app language if changed
    const userLang = SUPPORTED_LANGUAGES.find(l => l.code === profile.primaryLanguage);
    if (userLang) setLangA(userLang);
  };

  const handleError = (msg: string) => {
    setErrorMsg(msg);
    setAppState(AppState.ERROR);
    triggerHaptic('error');
    setTimeout(() => {
      setErrorMsg(null);
      setAppState(AppState.IDLE);
    }, 4000);
  };

  const playAudio = useCallback(async (audioData: ArrayBuffer) => {
    try {
      const ctx = getAudioContext();
      const buffer = await decodeAudioData(new Uint8Array(audioData), ctx, AUDIO_SAMPLE_RATE);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (err) {
      console.error("Audio playback error", err);
      handleError("Could not play audio.");
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Captures the current frame from the video element as a Base64 JPEG.
   * Used for facial expression analysis (Vision).
   */
  const captureVideoFrame = (): string | undefined => {
    if (!videoRef.current || !canvasRef.current) return undefined;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Only capture if video has data
    if (video.videoWidth === 0 || video.videoHeight === 0) return undefined;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      // Remove header for API
      return dataUrl.split(',')[1];
    }
    return undefined;
  };

  // --- CORE PROCESSING ---

  const processInput = async (
    text: string, 
    sourceLang: Language, 
    targetLang: Language, 
    sender: 'user' | 'partner',
    type: MessageType,
    mediaBlob?: Blob,
    isAutoReply: boolean = false
  ) => {
    setAppState(AppState.TRANSLATING);
    setInterimText(''); 
    
    // Clear suggestions if User is speaking/replying
    if (sender === 'user') {
      setSmartReplies([]);
    }

    const msgId = Date.now().toString();

    // FACIAL ANALYSIS CAPTURE
    // If it's a live video call or video recording, capture the face for emotion analysis
    let imageFrame: string | undefined = undefined;
    if ((type === 'video_live' || type === 'video_file') && videoRef.current) {
       // Note: For 'video_file' we are capturing from the live preview at the moment of send
       // In a full implementation, we might extract frame from the blob, but this works for live interactions.
       imageFrame = captureVideoFrame();
    }

    try {
      // 1. Translate (Pass Profile, History, and Image for Emotion Analysis)
      const translationResult = await translateContent(
        text, 
        sourceLang, 
        targetLang,
        userProfile, // Pass Profile
        messages, // Pass History
        imageFrame // Pass Video Frame for Facial Analysis
      );
      
      // Update Smart Replies if Partner spoke (so User can reply)
      if (sender === 'partner') {
        setSmartReplies(translationResult.suggestedResponses);
      }

      // 2. Generate Speech (Translated)
      let translatedAudioData: Uint8Array | undefined;
      try {
        translatedAudioData = await generateSpeech(translationResult.translatedText, targetLang.voiceName);
      } catch (e) {
        console.warn("TTS failed", e);
      }

      // 3. Construct Message
      const newMessage: Message = {
        id: msgId,
        type,
        originalText: text,
        translatedText: translationResult.translatedText,
        originalLang: sourceLang.code,
        targetLang: targetLang.code,
        sender,
        timestamp: Date.now(),
        suggestedResponses: translationResult.suggestedResponses,
        translatedAudioBuffer: translatedAudioData ? translatedAudioData.buffer : undefined,
        originalAudioBlob: mediaBlob, 
        videoBlob: (type === 'video_file' || type === 'video_live') ? mediaBlob : undefined,
        isAutoReply,
        detectedEmotion: translationResult.detectedEmotion // Store result from CNN/Vision analysis
      };

      // Add to messages via functional update to ensure latest state
      setMessages(prev => {
        const updatedMessages = [...prev, newMessage];
        triggerHaptic('success'); // Feedback for message added

        // --- AI AVATAR LOGIC ---
        // If the sender was the PARTNER, and AI Responder is ACTIVE, trigger an auto-reply
        if (sender === 'partner' && isAiResponderActive && userProfile) {
          triggerHaptic('warning'); // Subtle indicator that AI is picking up
          // Trigger the avatar response in the background
          generateAvatarReply(text, userProfile, updatedMessages)
            .then(aiReplyText => {
               // Simulate the USER sending this reply (Language A -> Language B)
               // Note: We recursively call processInput but with 'user' sender
               setTimeout(() => {
                 processInput(aiReplyText, langA, langB, 'user', 'text', undefined, true);
               }, 1000); // Slight delay to feel like "Thinking"
            })
            .catch(err => console.error("Avatar failed", err));
        }
        
        return updatedMessages;
      });

      setAppState(AppState.IDLE);

      // Auto-play logic based on Preference
      if (preference === OutputPreference.TRANSLATED && translatedAudioData) {
        await playAudio(translatedAudioData.buffer);
      } 

    } catch (err) {
      console.error(err);
      handleError("Processing failed. Please try again.");
      setAppState(AppState.IDLE);
    }
  };

  const handleSmartReply = (text: string) => {
    triggerHaptic('selection');
    // User selects a suggestion -> Sends to Partner
    processInput(text, langA, langB, 'user', 'text');
  };

  // --- FEATURE: LIVE AUDIO / VIDEO (Using Web Speech API) ---

  const startLiveListening = (sender: 'user' | 'partner') => {
    const w = window as unknown as IWindow;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      handleError("Speech recognition not supported in this browser.");
      return;
    }

    if (recognitionRef.current) recognitionRef.current.abort();

    const recognition = new SpeechRecognition();
    recognition.lang = sender === 'user' ? langA.code : langB.code;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true; // Keep listening until stopped manually

    recognition.onstart = () => {
      setRecordingWho(sender);
      setAppState(AppState.LISTENING);
      setInterimText('');
      triggerHaptic('selection');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        else interimTranscript += event.results[i][0].transcript;
      }

      if (interimTranscript) setInterimText(interimTranscript);

      if (finalTranscript) {
        // NOTE: For video calls, we want to capture the frame at the END of the sentence 
        // to get the reaction corresponding to what was said.
        recognition.stop(); 
        setInterimText(finalTranscript); 
        processInput(
          finalTranscript,
          sender === 'user' ? langA : langB,
          sender === 'user' ? langB : langA,
          sender,
          commMode === CommMode.LIVE_VIDEO ? 'video_live' : 'audio_live'
        );
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      console.error("Speech Rec Error", event.error);
      setRecordingWho(null);
      setAppState(AppState.IDLE);
      triggerHaptic('error');
    };

    recognition.onend = () => {
        setRecordingWho(null);
        if (appState === AppState.LISTENING) {
             setAppState(AppState.IDLE);
        }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopLiveListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      triggerHaptic('selection');
    }
  };

  const toggleLiveListening = (sender: 'user' | 'partner') => {
    triggerHaptic('selection');
    if (appState === AppState.LISTENING && recordingWho === sender) {
      stopLiveListening();
    } else {
      startLiveListening(sender);
    }
  };

  // --- FEATURE: RECORDED AUDIO / VIDEO ---

  const startMediaRecording = async (mode: CommMode, sender: 'user' | 'partner') => {
    try {
      const constraints = mode === CommMode.REC_VIDEO ? { video: true, audio: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        // blob creation handled in stop function after delay
      };

      mediaRecorder.start();
      setIsMediaRecording(true);
      setRecordingWho(sender);
      setAppState(AppState.RECORDING);
      triggerHaptic('heavy'); // Strong feedback for recording start

      // Start Recognition parallel to capture text
      const w = window as unknown as IWindow;
      const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.lang = sender === 'user' ? langA.code : langB.code;
          recognition.continuous = true; 
          recognition.interimResults = true;
          recognition.onresult = (e: any) => {
             let inter = '';
             for(let i=e.resultIndex; i<e.results.length; ++i) inter += e.results[i][0].transcript;
             setInterimText(inter);
          };
          recognitionRef.current = recognition;
          recognition.start();
      }

    } catch (err) {
      console.error("Media recording init failed", err);
      handleError("Could not access camera/microphone");
    }
  };

  const stopMediaRecording = () => {
    if (mediaRecorderRef.current && isMediaRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      
      if (recognitionRef.current) recognitionRef.current.stop();

      setIsMediaRecording(false);
      setRecordingWho(null);
      setAppState(AppState.IDLE); 
      triggerHaptic('heavy'); // Feedback for recording stop

      setTimeout(() => {
        const mimeType = commMode === CommMode.REC_VIDEO ? 'video/webm' : 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const finalSafeText = interimText || "(Audio Content)";

        const sender = recordingWho || 'user'; // Fallback
        
        processInput(
            finalSafeText,
            sender === 'user' ? langA : langB,
            sender === 'user' ? langB : langA,
            sender,
            commMode === CommMode.REC_VIDEO ? 'video_file' : 'audio_file',
            blob
        );
      }, 500);
    }
  };

  // --- FEATURE: TEXT MESSAGE ---

  const sendTextMessage = () => {
    if (!textInput.trim()) return;
    triggerHaptic('selection');
    processInput(textInput, langA, langB, 'user', 'text');
    setTextInput('');
  };

  // --- RENDERERS ---

  const renderModeSelector = () => (
    <div className="flex justify-between bg-white border-t border-gray-100 p-2 overflow-x-auto no-scrollbar gap-2">
      {[
        { id: CommMode.TEXT, label: 'Text Chat', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /> },
        { id: CommMode.LIVE_AUDIO, label: 'Live Talk', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /> },
        { id: CommMode.LIVE_VIDEO, label: 'Live Cam', icon: <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /> },
        { id: CommMode.REC_AUDIO, label: 'Voice Note', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /> },
        { id: CommMode.REC_VIDEO, label: 'Video Msg', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.125c0 .621.504 1.125 1.125 1.125Z" /> },
      ].map(mode => (
        <button
          key={mode.id}
          onClick={() => {
            setCommMode(mode.id as CommMode);
            triggerHaptic('selection');
          }}
          className={`flex flex-col items-center justify-center min-w-[70px] p-2 rounded-xl transition-all
            ${commMode === mode.id ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-gray-400 hover:bg-gray-50'}
          `}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mb-1">
            {mode.icon}
          </svg>
          <span className="text-[10px] font-bold uppercase">{mode.label}</span>
        </button>
      ))}
    </div>
  );

  const renderInputArea = () => {
    // 1. TEXT MODE
    if (commMode === CommMode.TEXT) {
      return (
        <div className="p-4 flex gap-2 items-center bg-white border-t border-gray-100">
           <input 
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={isAiResponderActive ? "AI Responder is active..." : "Type a message..."}
              disabled={isAiResponderActive}
              className="flex-1 bg-gray-100 border-0 rounded-full px-5 py-3 text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none disabled:opacity-50"
              onKeyDown={(e) => e.key === 'Enter' && sendTextMessage()}
           />
           <button 
             onClick={sendTextMessage}
             disabled={!textInput.trim() || isAiResponderActive}
             className="bg-indigo-600 text-white p-3 rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors"
           >
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
           </button>
        </div>
      );
    }

    // 2. LIVE MODES (Audio/Video)
    if (commMode === CommMode.LIVE_AUDIO || commMode === CommMode.LIVE_VIDEO) {
       const isUserRecording = recordingWho === 'user';
       const isPartnerRecording = recordingWho === 'partner';
       const isIdle = appState === AppState.IDLE;

       return (
         <div className="p-6 flex justify-between items-end gap-6 bg-white border-t border-gray-100">
            {/* USER BUTTON (Disable if AI Active) */}
            <button 
               onClick={() => toggleLiveListening('user')}
               disabled={(!isIdle && !isUserRecording) || isAiResponderActive}
               className={`flex-1 flex flex-col items-center justify-center p-6 rounded-3xl transition-all shadow-lg border-2 relative overflow-hidden
                  ${isUserRecording 
                    ? 'bg-red-50 border-red-500 scale-95 shadow-inner' 
                    : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-xl disabled:opacity-30 disabled:cursor-not-allowed'}`}
            >
               {isUserRecording && <span className="absolute inset-0 bg-red-500/10 animate-pulse"></span>}
               {isAiResponderActive && <span className="absolute inset-0 bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">AI ACTIVE</span>}
               <span className={`text-2xl mb-2 relative z-10 transition-transform ${isUserRecording ? 'scale-125' : ''}`}>{langA.flag}</span>
               <span className={`text-xs font-bold uppercase tracking-widest relative z-10 ${isUserRecording ? 'text-red-500' : 'text-gray-500'}`}>
                 {isUserRecording ? 'Tap to Stop' : 'Tap to Speak'}
               </span>
               <span className="text-lg font-bold text-gray-800 mt-1 relative z-10">{langA.name}</span>
            </button>

            {/* PARTNER BUTTON */}
            <button 
               onClick={() => toggleLiveListening('partner')}
               disabled={!isIdle && !isPartnerRecording}
               className={`flex-1 flex flex-col items-center justify-center p-6 rounded-3xl transition-all shadow-lg border-2 relative overflow-hidden
                  ${isPartnerRecording 
                    ? 'bg-red-50 border-red-500 scale-95 shadow-inner' 
                    : 'bg-white border-gray-100 hover:border-pink-200 hover:shadow-xl'}`}
            >
               {isPartnerRecording && <span className="absolute inset-0 bg-red-500/10 animate-pulse"></span>}
               <span className={`text-2xl mb-2 relative z-10 transition-transform ${isPartnerRecording ? 'scale-125' : ''}`}>{langB.flag}</span>
               <span className={`text-xs font-bold uppercase tracking-widest relative z-10 ${isPartnerRecording ? 'text-red-500' : 'text-gray-500'}`}>
                  {isPartnerRecording ? 'Tap to Stop' : 'Tap to Speak'}
               </span>
               <span className="text-lg font-bold text-gray-800 mt-1 relative z-10">{langB.name}</span>
            </button>
         </div>
       );
    }

    // 3. RECORDING MODES (File)
    if (commMode === CommMode.REC_AUDIO || commMode === CommMode.REC_VIDEO) {
      return (
        <div className="p-6 flex flex-col items-center bg-white border-t border-gray-100">
          {!isMediaRecording ? (
             <button
               onClick={() => startMediaRecording(commMode, 'user')}
               disabled={isAiResponderActive}
               className={`w-20 h-20 rounded-full bg-red-500 text-white shadow-xl flex items-center justify-center hover:bg-red-600 transition-all hover:scale-105 active:scale-95 disabled:bg-gray-300`}
             >
               <div className="w-8 h-8 bg-white rounded-full"></div>
             </button>
          ) : (
             <div className="flex flex-col items-center">
                <div className="text-2xl font-mono text-red-600 font-bold mb-4 animate-pulse">
                  {formatTime(mediaTimer)}
                </div>
                <button
                  onClick={stopMediaRecording}
                  className="w-20 h-20 rounded-full border-4 border-red-500 flex items-center justify-center hover:bg-red-50 transition-all"
                >
                  <div className="w-8 h-8 bg-red-500 rounded sm"></div>
                </button>
             </div>
          )}
          <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
            {isAiResponderActive ? 'AI Responder Active' : (isMediaRecording ? 'Recording...' : 'Tap to Record')}
          </p>
        </div>
      );
    }
  };

  const renderActiveBox = () => {
    // LIVE VIDEO PREVIEW OVERLAY
    const showVideo = (commMode === CommMode.LIVE_VIDEO || commMode === CommMode.REC_VIDEO);
    
    // Quick Responses for Assistive Mode
    const defaultQuickReplies = ["Yes", "No", "Thank you", "Please wait", "I don't understand"];
    const hasSmartReplies = smartReplies.length > 0;

    return (
      <div className="relative w-full h-full flex flex-col">
         {/* Toggle Preference Switch (Floats on top) */}
         <div className="absolute top-4 right-4 z-20 flex bg-white/90 backdrop-blur rounded-full p-1 shadow-sm border border-gray-200">
            <button 
              onClick={() => {
                setPreference(OutputPreference.TRANSLATED);
                triggerHaptic('selection');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${preference === OutputPreference.TRANSLATED ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Translated
            </button>
            <button 
              onClick={() => {
                setPreference(OutputPreference.ORIGINAL);
                triggerHaptic('selection');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${preference === OutputPreference.ORIGINAL ? 'bg-slate-800 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Original
            </button>
         </div>
         
         {/* AI Responder Overlay */}
         {isAiResponderActive && (
           <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-full shadow-lg animate-pulse">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span className="text-xs font-bold uppercase">AI Avatar Active</span>
           </div>
         )}

         {/* Video Feed Layer */}
         {showVideo && (
           <div className="absolute inset-0 z-0 bg-black">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline
                className={`w-full h-full object-cover opacity-80 ${isMediaRecording || appState === AppState.LISTENING ? 'opacity-100' : 'opacity-40'}`} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/30"></div>
           </div>
         )}
         
         {/* AI Avatar Ambient Background */}
         {isAiResponderActive && !showVideo && (
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-1000">
               {/* 1. Base Darkening for Contrast */}
               <div className="absolute inset-0 bg-indigo-900/5"></div>
               
               {/* 2. Primary Aura (Breathing) */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] animate-breathing"></div>
               
               {/* 3. Secondary Aura (Offset, faster pulse) */}
               <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-pink-500/10 rounded-full blur-[80px] animate-pulse"></div>

               {/* 4. The Digital Pattern (SVG) - Keep it subtle */}
               <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <svg viewBox="0 0 200 200" className="w-full h-full text-indigo-600 animate-spin-slow" style={{ animationDuration: '60s' }}>
                     <path fill="currentColor" d="M42.7,-62.9C55.4,-52.8,65.8,-41.4,72.6,-28.5C79.5,-15.6,82.8,-1.2,78.9,11.5C75,24.2,63.9,35.2,52.3,44.7C40.6,54.2,28.4,62.2,15.2,66.1C2,70.1,-12.3,70.1,-25.1,65.5C-37.9,60.9,-49.3,51.8,-58.5,40.6C-67.7,29.4,-74.7,16.1,-75.4,2.5C-76.1,-11.1,-70.5,-25,-60.9,-36.4C-51.3,-47.8,-37.7,-56.7,-24.1,-65.8C-10.5,-74.9,3,-84.3,16.3,-83.1C29.6,-81.9,42.7,-70.1,42.7,-62.9Z" transform="translate(100 100)" />
                  </svg>
               </div>
            </div>
         )}

         {/* Content Layer */}
         <div className="relative z-10 flex-1 flex flex-col p-6 overflow-y-auto">
            {/* Interim Text Display */}
            {(appState === AppState.LISTENING || appState === AppState.RECORDING) && (
               <div className="mt-auto mb-10 text-center">
                  <div className="inline-block px-3 py-1 bg-red-500/20 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-widest mb-2 backdrop-blur-sm border border-red-500/20">
                     {appState === AppState.RECORDING ? 'Recording' : 'Listening...'}
                  </div>
                  <p className={`text-2xl md:text-3xl font-light italic leading-relaxed ${showVideo ? 'text-white drop-shadow-md' : 'text-slate-700'}`}>
                    "{interimText || "..."}"
                  </p>
               </div>
            )}

            {/* Translating State */}
            {appState === AppState.TRANSLATING && (
               <div className="m-auto flex flex-col items-center">
                   <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                   <p className={`${showVideo ? 'text-white' : 'text-indigo-600'} font-bold animate-pulse`}>Processing...</p>
               </div>
            )}

            {/* Idle / Result State - Top Section */}
            {appState === AppState.IDLE && messages.length > 0 && !isMediaRecording && (
               <div className="mt-auto mb-6">
                 {/* Show latest message result specifically in box */}
                 <div className={`${showVideo ? 'text-white' : 'text-slate-800'}`}>
                    {messages[messages.length-1].isAutoReply && (
                       <span className="inline-block px-2 py-1 mb-2 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold uppercase">AI Auto-Reply</span>
                    )}
                    {/* Emotion Badge in Active Box */}
                    {messages[messages.length-1].detectedEmotion && (
                        <div className="inline-block px-2 py-1 mb-2 ml-2 bg-white/20 border border-white/40 rounded text-[10px] font-bold uppercase text-indigo-500 md:text-white">
                           {messages[messages.length-1].detectedEmotion}
                        </div>
                    )}
                    
                    <p className="text-3xl font-bold leading-tight mb-2">
                      {preference === OutputPreference.TRANSLATED 
                        ? messages[messages.length-1].translatedText 
                        : messages[messages.length-1].originalText}
                    </p>
                    <p className={`text-sm italic opacity-70`}>
                      {preference === OutputPreference.TRANSLATED 
                        ? messages[messages.length-1].originalText 
                        : messages[messages.length-1].translatedText}
                    </p>
                 </div>
               </div>
            )}

            {/* SMART ASSIST / SUGGESTIONS PANEL (Always at bottom if idle) */}
            {appState === AppState.IDLE && !isAiResponderActive && (
              <div className="mt-2 space-y-3">
                 {/* AI Smart Suggestions */}
                 {hasSmartReplies && (
                   <div className="animate-fade-in-up">
                     <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${showVideo ? 'text-white/60' : 'text-indigo-400'}`}>
                        Smart Assist ({userProfile?.name}'s AI)
                     </p>
                     <div className="grid grid-cols-1 gap-2">
                       {smartReplies.map((reply, idx) => (
                         <button
                           key={idx}
                           onClick={() => handleSmartReply(reply)}
                           className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl text-left font-medium shadow-md active:scale-95 transition-all flex justify-between items-center group"
                         >
                            <span>{reply}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity">
                              <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                            </svg>
                         </button>
                       ))}
                     </div>
                   </div>
                 )}
                 
                 {/* Quick Static Replies */}
                 <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${showVideo ? 'text-white/60' : 'text-slate-400'}`}>Quick Assist</p>
                    <div className="flex flex-wrap gap-2">
                      {defaultQuickReplies.map((reply) => (
                         <button
                           key={reply}
                           onClick={() => handleSmartReply(reply)}
                           className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all border
                             ${showVideo 
                               ? 'bg-white/10 text-white border-white/20 hover:bg-white/20' 
                               : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 shadow-sm'}`}
                         >
                           {reply}
                         </button>
                      ))}
                    </div>
                 </div>
              </div>
            )}
            
            {/* AI ACTIVE NOTICE IN PANEL */}
            {isAiResponderActive && (
               <div className="mt-auto bg-indigo-50 border border-indigo-200 p-4 rounded-xl text-center">
                  <p className="text-indigo-700 font-bold text-sm">Auto-Response Mode Active</p>
                  <p className="text-indigo-500 text-xs">Your AI Avatar is listening and replying for you.</p>
               </div>
            )}
         </div>
      </div>
    );
  };

  const HeaderContent = ({ mobile = false }) => (
    <>
      <div className="flex items-center gap-2">
        <LanguageSelector label="You" selected={langA} onSelect={setLangA} align="left" />
        {/* Profile Edit Button */}
        <button 
          onClick={() => {
            setShowProfileSetup(true);
            triggerHaptic('selection');
          }}
          className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 transition-colors mt-4"
          title="Edit Profile"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A9.916 9.916 0 0 0 10 18c2.314 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003 5.999 5.999 0 0 0 .329-1.103V12h11.2ZM10 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" clipRule="evenodd" />
          </svg>
        </button>
        
        {/* AI Auto-Response Toggle */}
        <button
           onClick={() => {
             setIsAiResponderActive(!isAiResponderActive);
             triggerHaptic('selection');
           }}
           className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors mt-4
             ${isAiResponderActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
           title={isAiResponderActive ? "Turn off AI Responder" : "Busy? Turn on AI Responder"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
             <path fillRule="evenodd" d="M10 2a4 4 0 0 0-4 4v1H5a1 1 0 0 0-.994.89l-1 9A1 1 0 0 0 4 18h12a1 1 0 0 0 .994-1.11l-1-9A1 1 0 0 0 15 7h-1V6a4 4 0 0 0-4-4Zm2 5V6a2 2 0 1 0-4 0v1h4Zm-6 3a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm7-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      <div className="text-center">
        <h1 className="text-lg font-black tracking-tighter text-indigo-900 leading-none">OMNI<span className="text-indigo-500">TALK</span></h1>
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Universal Hub</span>
      </div>
      
      <LanguageSelector label="Partner" selected={langB} onSelect={setLangB} align="right" />
    </>
  );

  return (
    <div className="h-screen w-full bg-slate-100 flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Profile Setup Modal */}
      {showProfileSetup && (
        <ProfileSetup 
          initialProfile={userProfile} 
          onSave={saveProfile} 
          onCancel={() => setShowProfileSetup(false)} 
          isFirstRun={!userProfile}
        />
      )}

      {/* MOBILE HEADER */}
      <header className="md:hidden flex-none bg-white/90 backdrop-blur-md px-4 py-2 border-b border-gray-200 flex justify-between items-center z-20">
         <HeaderContent mobile={true} />
      </header>

      {/* LEFT: HISTORY */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50 order-1">
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 no-scrollbar pb-32 md:pb-8">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30">
                 <div className="w-24 h-24 bg-indigo-200 rounded-full mb-4 animate-pulse"></div>
                 <p>Start a conversation...</p>
                 {userProfile && <p className="text-xs mt-2 text-indigo-500">Welcome back, {userProfile.name}</p>}
              </div>
            )}
            {messages.map((msg) => (
                <ChatMessage 
                    key={msg.id} 
                    message={msg} 
                    preference={preference}
                    onPlayAudio={playAudio}
                    onSelectSuggestion={(txt) => {}} // Deprecated in favor of Dashboard
                    isLatest={false} 
                />
            ))}
            <div ref={messagesEndRef} />
          </div>
      </main>

      {/* RIGHT: DASHBOARD */}
      <aside className="
          order-2 z-30 flex flex-col bg-white shadow-2xl
          w-full md:w-[450px] lg:w-[500px] h-[65%] md:h-full border-l border-gray-200
      ">
        <div className="hidden md:flex flex-none px-6 py-4 border-b border-gray-100 justify-between items-center">
           <HeaderContent />
        </div>

        {/* ACTIVE SCREEN */}
        <div className="flex-1 relative bg-slate-900 overflow-hidden">
           {renderActiveBox()}
        </div>

        {/* CONTROLS */}
        <div className="flex-none bg-white flex flex-col">
           {renderModeSelector()}
           {renderInputArea()}
        </div>
      </aside>

    </div>
  );
};

export default App;
