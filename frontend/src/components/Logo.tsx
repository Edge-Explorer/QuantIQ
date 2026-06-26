interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 48, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <defs>
        {/* Glow Filters */}
        <filter id="logo-glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="logo-glow-violet" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        {/* Gradients */}
        <linearGradient id="violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="cyan-grad" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>

      {/* Background shape (hidden by default, transparent vector) */}
      
      {/* Concentric Guide Ring (Thin Outer) */}
      <circle
        cx="50"
        cy="50"
        r="44"
        stroke="url(#violet-grad)"
        strokeWidth="0.75"
        strokeDasharray="4 8 20 8"
        opacity="0.3"
      />

      {/* Main Q Circle body (Thick Outer Arc) */}
      {/* Radius 38, Center 50,50. Gap on right (around y=50) */}
      <path
        d="M 87.2,42.1 A 38,38 0 1,0 87.2,57.9"
        stroke="url(#violet-grad)"
        strokeWidth="5.5"
        strokeLinecap="round"
        filter="url(#logo-glow-violet)"
      />

      {/* Inner Thin Arc */}
      <path
        d="M 79.0,42.2 A 30,30 0 1,0 79.0,57.8"
        stroke="url(#violet-grad)"
        strokeWidth="1.2"
        opacity="0.55"
      />

      {/* Q Diagonal Tail */}
      <line
        x1="70.5"
        y1="70.5"
        x2="88"
        y2="88"
        stroke="url(#violet-grad)"
        strokeWidth="6"
        strokeLinecap="round"
        filter="url(#logo-glow-violet)"
      />
      
      {/* Decorative hud ticks inside the Q gap */}
      <line x1="82" y1="46" x2="88" y2="46" stroke="url(#violet-grad)" strokeWidth="1" opacity="0.7" />
      <line x1="82" y1="54" x2="88" y2="54" stroke="url(#violet-grad)" strokeWidth="1" opacity="0.7" />

      {/* Neon Cyan Stock / Heartbeat Signal Line */}
      {/* 1. Glow Layer */}
      <path
        d="M 12,50 L 35,50 L 39,54 L 43,46 L 47,62 L 51,38 L 55,60 L 59,48 L 63,52 L 67,49 L 71,51 L 76,50 L 88,50"
        stroke="#00f2fe"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#logo-glow-cyan)"
      />
      {/* 2. Core High-Contrast Bright Layer */}
      <path
        d="M 12,50 L 35,50 L 39,54 L 43,46 L 47,62 L 51,38 L 55,60 L 59,48 L 63,52 L 67,49 L 71,51 L 76,50 L 88,50"
        stroke="#e0fbfc"
        strokeWidth="1.0"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Neon glowing junction dots */}
      <circle cx="35" cy="50" r="1.5" fill="#e0fbfc" filter="url(#logo-glow-cyan)" />
      <circle cx="47" cy="62" r="1.5" fill="#e0fbfc" filter="url(#logo-glow-cyan)" />
      <circle cx="51" cy="38" r="1.5" fill="#e0fbfc" filter="url(#logo-glow-cyan)" />
      <circle cx="55" cy="60" r="1.5" fill="#e0fbfc" filter="url(#logo-glow-cyan)" />
      <circle cx="76" cy="50" r="1.5" fill="#e0fbfc" filter="url(#logo-glow-cyan)" />
    </svg>
  );
}
