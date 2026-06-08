import React, { useRef, useState, useEffect } from 'react';
import { ArrowUpDown, HelpCircle, CheckCircle } from 'lucide-react';

interface StudentTrackProps {
  key?: number | string;
  index: number; // 0..30
  score: number; // 0..100
  name: string;
  onScoreChange: (index: number, newScore: number) => void;
  onSave: () => void | Promise<void>;
}

export default function StudentTrack({
  index,
  score,
  name,
  onScoreChange,
  onSave,
}: StudentTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localScore, setLocalScore] = useState(score);

  // Sync internal local score state with parent changes
  useEffect(() => {
    setLocalScore(score);
  }, [score]);

  // Handle pointer down
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    updateScoreFromPointer(e);
  };

  // Convert vertical drag coordinates into 0..100 score value
  const updateScoreFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const trackHeight = rect.height;
    
    // Y-coordinate from the top of the track down to the bottom
    let relativeY = e.clientY - rect.top;
    
    // Clamp inside track heights
    if (relativeY < 0) relativeY = 0;
    if (relativeY > trackHeight) relativeY = trackHeight;

    // Bottom is 0, Top is 100
    const rawScore = Math.round((1 - relativeY / trackHeight) * 100);
    setLocalScore(rawScore);
    onScoreChange(index, rawScore);
  };

  // Handle pointer move
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    updateScoreFromPointer(e);
  };

  // Handle pointer up
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
    onSave(); // Persist changes to server
  };

  // Determine current tier from score
  const getTierInfo = (scoreVal: number) => {
    if (scoreVal >= 67) {
      return {
        label: '우주',
        color: 'from-indigo-600 via-purple-600 to-pink-500',
        textColor: 'text-purple-300',
        bg: 'bg-purple-950/60',
        glow: 'shadow-purple-500/50 hover:bg-purple-500',
        emoji: '🌌'
      };
    } else if (scoreVal >= 34) {
      return {
        label: '하늘',
        color: 'from-sky-400 to-emerald-400',
        textColor: 'text-sky-300',
        bg: 'bg-sky-950/60',
        glow: 'shadow-sky-400/50 hover:bg-sky-400',
        emoji: '☁️'
      };
    } else {
      return {
        label: '땅',
        color: 'from-amber-600 to-emerald-700',
        textColor: 'text-emerald-300',
        bg: 'bg-emerald-950/60',
        glow: 'shadow-emerald-500/50 hover:bg-emerald-600',
        emoji: '🌱'
      };
    }
  };

  const tier = getTierInfo(localScore);

  return (
    <div className="flex flex-col items-center bg-slate-900/30 p-1.5 rounded-xl border border-slate-800/50 shadow-sm w-[72px] flex-shrink-0 relative group">
      {/* Target student header */}
      <span className="text-[9px] text-slate-500 font-mono mb-0.5">#{index + 1}</span>
      <h4 
        className="text-[10px] font-bold text-slate-100 mb-2 truncate max-w-full" 
        title={name}
      >
        {name}
      </h4>

      {/* Vertical slider tracks */}
      <div 
        ref={trackRef}
        className="w-7 h-[460px] rounded-full relative bg-slate-950/80 border border-slate-800/60 shadow-inner select-none cursor-pointer"
        style={{
          // background layout spanning Space / Sky / Earth gradients together vertically
          background: 'linear-gradient(to bottom, rgba(147, 51, 234, 0.25) 0%, rgba(56, 189, 248, 0.25) 50%, rgba(34, 211, 238, 0.05) 51%, rgba(16, 185, 129, 0.2) 100%)'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Fill representing Ground, Sky, Space relative level */}
        <div 
          className="absolute bottom-0 left-0 right-0 rounded-full opacity-10 pointer-events-none"
          style={{
            height: `${localScore}%`,
            background: 'linear-gradient(to top, #10b981 0%, #38bdf8 50%, #a855f7 100%)'
          }}
        />

        {/* Draggable Circle Node */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-6.5 h-6.5 rounded-full flex items-center justify-center font-bold text-[10px] text-slate-950 cursor-ns-resize shadow-md transition-shadow select-none border border-white/20 ${
            isDragging ? 'scale-110 shadow-lg' : 'hover:scale-105 shadow-sm'
          } bg-gradient-to-tr ${tier.color} ${tier.glow}`}
          style={{
            bottom: `calc(${localScore}%)`
          }}
        >
          {index + 1}
        </div>

        {/* Background sector boundary marks */}
        <div className="absolute top-[33%] left-0 right-0 border-t border-sky-400/10 pointer-events-none" />
        <div className="absolute top-[66%] left-0 right-0 border-t border-purple-500/10 pointer-events-none" />
      </div>

      {/* Tier Label Indicators */}
      <div className={`mt-3 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-tight text-center w-full ${tier.bg} ${tier.textColor}`}>
        <span>{tier.emoji} {localScore}P</span>
      </div>

      {/* Helper drag indicator appearing on hover */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 p-1 rounded-md text-[7px] pointer-events-none text-slate-400 border border-slate-800">
        드래그
      </div>
    </div>
  );
}
