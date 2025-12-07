import React from 'react';

interface MicButtonProps {
  onClick: () => void;
  isActive: boolean;
  disabled: boolean;
  label: string;
  colorClass: string;
}

export const MicButton: React.FC<MicButtonProps> = ({ 
  onClick, 
  isActive, 
  disabled, 
  label,
  colorClass
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative group flex flex-col items-center justify-center w-full transition-all duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'opacity-100 cursor-pointer'}
      `}
    >
      <div className={`
        relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300
        ${isActive ? 'scale-110 shadow-xl' : 'scale-100 hover:scale-105'}
        ${colorClass}
      `}>
         {/* Ripple effect when active */}
         {isActive && (
           <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${colorClass}`}></span>
         )}
        
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white z-10">
          <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
          <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
        </svg>
      </div>
      <span className="mt-3 text-sm font-semibold text-gray-600 tracking-wide uppercase">{label}</span>
    </button>
  );
};
