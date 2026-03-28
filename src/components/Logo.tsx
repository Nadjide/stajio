import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Notebook / Graduation Cap Base */}
        <path
          d="M20 35L50 20L80 35L50 50L20 35Z"
          fill="#10b981"
          stroke="#059669"
          strokeWidth="2"
        />
        <path
          d="M25 40V65C25 65 35 75 50 75C65 75 75 65 75 65V40"
          stroke="#059669"
          strokeWidth="2"
          strokeLinecap="round"
        />
        
        {/* Tassel */}
        <path
          d="M80 35V55"
          stroke="#059669"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="80" cy="58" r="3" fill="#059669" />

        {/* AI / Tech Motif (Sparkle) */}
        <path
          d="M50 30L52 35L57 37L52 39L50 44L48 39L43 37L48 35L50 30Z"
          fill="white"
          className="animate-pulse"
        />
        
        {/* Subtle Circuit Lines */}
        <path
          d="M35 55H45M55 55H65M40 62H60"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
    </div>
  );
};
