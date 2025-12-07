import React from 'react';
import { Language } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';

interface LanguageSelectorProps {
  label: string;
  selected: Language;
  onSelect: (lang: Language) => void;
  align?: 'left' | 'right';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  label, 
  selected, 
  onSelect,
  align = 'left'
}) => {
  return (
    <div className={`flex flex-col ${align === 'right' ? 'items-end' : 'items-start'}`}>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 px-1">
        {label}
      </label>
      <div className="relative group">
        <select
          value={selected.code}
          onChange={(e) => {
            const lang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
            if (lang) onSelect(lang);
          }}
          className={`appearance-none bg-white border border-gray-200 text-gray-800 py-3 pl-4 pr-10 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-lg min-w-[140px] cursor-pointer`}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>
    </div>
  );
};
