import React, { useState } from 'react';
import { UserProfile, Language } from '../types';
import { CONVERSATION_TOPICS, TONE_PREFERENCES, SUPPORTED_LANGUAGES } from '../constants';

interface ProfileSetupProps {
  initialProfile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  onCancel: () => void;
  isFirstRun: boolean;
}

export const ProfileSetup: React.FC<ProfileSetupProps> = ({ initialProfile, onSave, onCancel, isFirstRun }) => {
  const [formData, setFormData] = useState<UserProfile>(initialProfile || {
    name: '',
    primaryLanguage: 'en-US',
    conversationTypes: [],
    tone: [], // Initialize as empty array for multi-select
    bio: ''
  });

  const toggleTopic = (topic: string) => {
    setFormData(prev => {
      const exists = prev.conversationTypes.includes(topic);
      if (exists) return { ...prev, conversationTypes: prev.conversationTypes.filter(t => t !== topic) };
      if (prev.conversationTypes.length >= 4) return prev; // Limit to 4
      return { ...prev, conversationTypes: [...prev.conversationTypes, topic] };
    });
  };

  const toggleTone = (selectedTone: string) => {
    setFormData(prev => {
      const currentTones = prev.tone; 
      const exists = currentTones.includes(selectedTone);
      
      if (exists) {
        return { ...prev, tone: currentTones.filter(t => t !== selectedTone) };
      }
      
      if (currentTones.length >= 4) return prev; // Limit to 4
      return { ...prev, tone: [...currentTones, selectedTone] };
    });
  };

  const isFormValid = formData.name.length > 0 && formData.conversationTypes.length > 0 && formData.tone.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white text-center">
          <h2 className="text-2xl font-black uppercase tracking-tight">
            {isFirstRun ? 'Welcome to OmniTalk' : 'Edit Profile'}
          </h2>
          <p className="text-indigo-100 text-sm mt-1">
            Let's personalize your AI translator experience.
          </p>
        </div>

        {/* Scrollable Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Name */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Display Name</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Alex"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Primary Language */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">My Primary Language</label>
            <select
              value={formData.primaryLanguage}
              onChange={e => setFormData({...formData, primaryLanguage: e.target.value})}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none"
            >
              {SUPPORTED_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
              ))}
            </select>
          </div>

          {/* Topics */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
              Conversation Goals <span className="text-indigo-500">(Pick up to 4)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CONVERSATION_TOPICS.map(topic => {
                const isSelected = formData.conversationTypes.includes(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border
                      ${isSelected 
                        ? 'bg-indigo-100 border-indigo-500 text-indigo-700 shadow-sm' 
                        : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
              Preferred Tone <span className="text-indigo-500">(Pick up to 4)</span>
            </label>
            <div className="flex flex-wrap gap-2">
               {TONE_PREFERENCES.map(tone => {
                 const isSelected = formData.tone.includes(tone);
                 return (
                  <button
                    key={tone}
                    onClick={() => toggleTone(tone)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border
                      ${isSelected 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                        : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-gray-700'}
                    `}
                  >
                    {tone}
                  </button>
                 );
               })}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Context Bio (Optional)</label>
            <textarea
              value={formData.bio}
              onChange={e => setFormData({...formData, bio: e.target.value})}
              placeholder="E.g. I am a medical student traveling to Spain..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 h-24 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          {!isFirstRun && (
            <button 
              onClick={onCancel}
              className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => isFormValid && onSave(formData)}
            disabled={!isFormValid}
            className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-all
              ${isFormValid ? 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02]' : 'bg-gray-300 cursor-not-allowed'}
            `}
          >
            {isFirstRun ? 'Start Experience' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};