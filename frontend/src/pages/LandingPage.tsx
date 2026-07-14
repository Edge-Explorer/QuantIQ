import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { X, Eye, EyeOff, Lock, Mail, User, Globe, ArrowRight, ArrowLeft } from 'lucide-react';

import Logo from '../components/Logo';
import LogoLoop from '../components/LogoLoop';
import Sparkline from '../components/Sparkline';
import { SiReact, SiTypescript, SiFastapi, SiPostgresql, SiGraphql, SiApachekafka, SiRazorpay, SiTailwindcss, SiPython, SiGrafana } from 'react-icons/si';


interface LandingPageProps {
  onGoogleLogin: (response: any) => Promise<void>;
  googleClientId: string;
  onAuthSuccess: (token: string) => void;
  apiUrl: string;
  user?: any;
  onGoToDashboard?: () => void;
}

type AuthMode = 'signin' | 'signup' | 'verify';

function GithubIcon({ size = 14, className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export default function LandingPage({ onGoogleLogin, googleClientId, onAuthSuccess, apiUrl, user, onGoToDashboard }: LandingPageProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // 3D CSS Book Stack Widget States
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isBookAnimating, setIsBookAnimating] = useState(false);
  const [bookPage, setBookPage] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  // Book Form States
  const [bookName, setBookName] = useState('');
  const [bookEmail, setBookEmail] = useState('');
  const [bookMessage, setBookMessage] = useState('');
  const [bookFormLoading, setBookFormLoading] = useState(false);
  const [bookFormSuccess, setBookFormSuccess] = useState<string | null>(null);
  const [bookFormError, setBookFormError] = useState<string | null>(null);

  // Programmatic Page Turn Sound Synthesizer (Web Audio API)
  const playPageTurnSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bufferSize = audioCtx.sampleRate * 0.35; // 0.35 seconds
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Fill buffer with white noise (paper texture rustle)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = buffer;
      
      // Filter out high/low frequencies (bandpass around 900Hz to sound like paper rustling)
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, audioCtx.currentTime);
      filter.Q.setValueAtTime(1.2, audioCtx.currentTime);
      // Sweep the frequency down to mimic a page turning over
      filter.frequency.exponentialRampToValueAtTime(250, audioCtx.currentTime + 0.3);
      
      // Volume envelope (fade-in quickly, fade-out smoothly)
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.33);
      
      // Connect nodes
      noiseSource.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      noiseSource.start();
      noiseSource.stop(audioCtx.currentTime + 0.35);
    } catch (err) {
      console.warn("Web Audio API is not supported or blocked by browser: ", err);
    }
  };

  const handleNextPage = () => {
    playPageTurnSound();
    setBookPage(prev => Math.min(prev + 1, 4));
  };

  const handlePrevPage = () => {
    playPageTurnSound();
    setBookPage(prev => Math.max(prev - 1, 1));
  };

  const handleOpenBook = () => {
    if (isBookAnimating || isBookOpen) return;
    playPageTurnSound();
    setIsBookAnimating(true);
    // Wait for fly-out animation to finish, then open the modal
    setTimeout(() => {
      setIsBookAnimating(false);
      setIsBookOpen(true);
      setBookPage(1);
    }, 650);
  };

  const handleCloseBook = () => {
    playPageTurnSound();
    setIsBookOpen(false);
  };

  const handleBookContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookFormError(null);
    setBookFormSuccess(null);
    
    if (!bookName || !bookEmail || !bookMessage) {
      setBookFormError("All fields are required.");
      return;
    }
    
    setBookFormLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bookName.trim(),
          email: bookEmail.trim(),
          message: bookMessage.trim()
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Message dispatch failed.");
      }
      
      setBookFormSuccess("Your message was dispatched successfully!");
      setBookName('');
      setBookEmail('');
      setBookMessage('');
    } catch (err: any) {
      setBookFormError(err.message || "Could not dispatch message.");
    } finally {
      setBookFormLoading(false);
    }
  };
  const [showReachUs, setShowReachUs] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  
  // Contact Form States
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  
  // UI Helpers
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [githubStars, setGithubStars] = useState<string | null>(null);
  
  // OTP Verification States
  const [otp, setOtp] = useState('');
  const [emailToVerify, setEmailToVerify] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // OTP Countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Reset verification states when auth modal closes
  useEffect(() => {
    if (!showAuthModal) {
      setOtp('');
      setEmailToVerify('');
      setResendCooldown(0);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [showAuthModal]);

  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Fetch actual GitHub stargazers count for the repository
  useEffect(() => {
    fetch('https://api.github.com/repos/Edge-Explorer/QuantIQ')
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        const count = data.stargazers_count;
        if (typeof count === 'number') {
          if (count >= 1000) {
            setGithubStars(`${(count / 1000).toFixed(1)}K`);
          } else {
            setGithubStars(count.toString());
          }
        }
      })
      .catch(() => {
        // Fallback default
        setGithubStars('Star');
      });
  }, []);

  // Market Movers live state
  const [marketMovers, setMarketMovers] = useState<{
    gainers: any[]; losers: any[]; most_active: any[];
  }>({
    gainers: [
      { symbol: 'SLBT', name: 'SL Science Holding', price: 5.99, changePercent: 34.61 },
      { symbol: 'PLBL', name: 'Polibeli Group Ltd', price: 10.26, changePercent: 18.20 },
      { symbol: 'GPC', name: 'Genuine Parts Co.', price: 132.57, changePercent: 12.92 },
      { symbol: 'SLS', name: 'SELLAS Life Sciences', price: 14.98, changePercent: 12.89 },
      { symbol: 'CAR', name: 'Avis Budget Group', price: 163.44, changePercent: 11.23 },
    ],
    losers: [
      { symbol: 'RGC', name: 'Regencell Bioscience', price: 6.37, changePercent: -20.67 },
      { symbol: 'VICR', name: 'Vicor Corporation', price: 282.95, changePercent: -19.21 },
      { symbol: 'ACLS', name: 'Axcelis Technologies', price: 144.50, changePercent: -18.97 },
      { symbol: 'VECO', name: 'Veeco Instruments', price: 57.49, changePercent: -18.48 },
      { symbol: 'BELFA', name: 'Bel Fuse Inc.', price: 230.16, changePercent: -18.29 },
    ],
    most_active: [
      { symbol: 'AAL', name: 'American Airlines', price: 17.92, changePercent: -1.27 },
      { symbol: 'T', name: 'AT&T Inc.', price: 20.58, changePercent: 0.49 },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 194.83, changePercent: -1.39 },
      { symbol: 'INTC', name: 'Intel Corporation', price: 120.35, changePercent: -5.25 },
      { symbol: 'OPEN', name: 'Opendoor Technologies', price: 4.90, changePercent: -0.81 },
    ],
  });

  useEffect(() => {
    let active = true;
    const fetchMovers = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/v1/stocks/market-movers`);
        if (res.ok) {
          const data = await res.json();
          if (active && data.gainers?.length) setMarketMovers(data);
        }
      } catch (err) {
        console.error('Landing market movers fetch failed:', err);
      }
    };
    fetchMovers();
    const interval = setInterval(fetchMovers, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [apiUrl]);

  // Landing Page News state
  const [landingNews, setLandingNews] = useState<any[]>([
    {
      id: 1,
      title: 'Federal Reserve Signals Potential Rate Cuts Later This Year',
      summary: 'Fed Chair Powell indicated inflation is returning to the 2% target path, hinting at upcoming rate adjustments that could fuel market momentum.',
      source: 'Bloomberg',
      time: '12m ago',
      category: 'Macro',
      link: 'https://www.bloomberg.com/markets'
    },
    {
      id: 2,
      title: 'NVIDIA Demand Outstrips Supply as Tech Giants Expand AI Infrastructure',
      summary: 'Top cloud providers continue to place record-breaking chip orders. Financial firms hike price targets as AI hardware revenues reach unprecedented highs.',
      source: 'Reuters',
      time: '35m ago',
      category: 'Technology',
      link: 'https://www.reuters.com/technology'
    },
    {
      id: 3,
      title: 'Bitcoin Solidifies Base Around $60K; On-Chain Accumulation Spikes',
      summary: 'Market intelligence data shows heavy whale wallet accumulation at current support levels, indicating solid long-term investor conviction.',
      source: 'CoinDesk',
      time: '1h ago',
      category: 'Crypto',
      link: 'https://www.coindesk.com'
    },
    {
      id: 4,
      title: 'Global Tech Stock Indexes Experience Rotational Capital Inflows',
      summary: 'Defensive sector gains support stock index benchmarks as fund managers rebalance portfolios ahead of upcoming CPI updates.',
      source: 'CNBC',
      time: '2h ago',
      category: 'Markets',
      link: 'https://www.cnbc.com/markets'
    },
    {
      id: 5,
      title: 'Tesla Q3 Deliveries Beat Expectations; Stock Surges Pre-Market',
      summary: 'Tesla reported record deliveries surpassing analyst forecasts, signaling strong demand recovery and boosting EV market confidence.',
      source: 'MarketWatch',
      time: '3h ago',
      category: 'Stocks',
      link: 'https://www.marketwatch.com'
    },
    {
      id: 6,
      title: 'Apple Vision Pro Drives New Wave of Spatial Computing Investments',
      summary: 'Institutional investors are increasing exposure to companies developing spatial computing platforms following Apple\'s growing developer ecosystem.',
      source: 'Wall Street Journal',
      time: '4h ago',
      category: 'Technology',
      link: 'https://www.wsj.com/tech'
    },
  ]);

  useEffect(() => {
    let active = true;
    const fetchLandingNews = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/v1/stocks/news`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0 && active) {
            setLandingNews(data.map((item: any) => ({
              id: item.id || Math.random().toString(),
              title: item.title,
              summary: item.summary || '',
              source: item.source || 'Finance',
              time: item.time || 'Recent',
              category: item.category || 'Markets',
              link: item.link || item.url || item.article_url || null,
            })));
          }
        }
      } catch (err) {
        console.error('Landing news fetch failed:', err);
      }
    };
    fetchLandingNews();
    const newsInterval = setInterval(fetchLandingNews, 300000); // refresh every 5 min
    return () => { active = false; clearInterval(newsInterval); };
  }, [apiUrl]);

  useEffect(() => {
    // Append Google Identity Services SDK script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google && googleButtonRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId || 'dummy-client-id.apps.googleusercontent.com',
            callback: onGoogleLogin,
          });
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'filled_blue',
            size: 'large',
            width: 280,
          });
        } catch (err) {
          console.error("Error loading Google GIS SDK:", err);
        }
      }
    };

    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {
        // Safe catch if script was already unmounted
      }
    };
  }, [googleClientId, onGoogleLogin, showAuthModal]);

  // Re-run script loader whenever modal opens to render the Google Button
  useEffect(() => {
    if (showAuthModal && window.google && googleButtonRef.current) {
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'filled_blue',
        size: 'large',
        width: 280,
      });
    }
    // Clear alerts and reset form fields when modal toggles
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [showAuthModal]);

  const toggleAuthMode = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (authMode === 'verify') {
      setAuthMode('signin');
    } else {
      setAuthMode(prev => prev === 'signin' ? 'signup' : 'signin');
    }
  };

  const handleTraditionalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Basic Validation
    if (!email || !password) {
      setErrorMsg("Email and password are required.");
      return;
    }

    if (authMode === 'signup') {
      if (!fullName || !country) {
        setErrorMsg("All fields are required for sign up.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        setErrorMsg("Password must be at least 6 characters.");
        return;
      }
    }

    setLoading(true);

    try {
      if (authMode === 'signup') {
        const response = await fetch(`${apiUrl}/api/v1/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            full_name: fullName.trim(),
            country: country.trim(),
            password: password
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Sign up failed.");
        }

        if (data.verification_required) {
          setEmailToVerify(email.trim());
          setAuthMode('verify');
          setOtp('');
          setResendCooldown(60);
          setSuccessMsg("Account registered! A 6-digit verification code has been sent to your email.");
          setPassword('');
          setConfirmPassword('');
        } else if (data.access_token) {
          setSuccessMsg("Account created successfully!");
          setTimeout(() => {
            onAuthSuccess(data.access_token);
            setShowAuthModal(false);
          }, 1000);
        }
      } else {
        // Sign In
        const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password: password
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Invalid email or password.");
        }

        if (data.verification_required) {
          setEmailToVerify(email.trim());
          setAuthMode('verify');
          setOtp('');
          setResendCooldown(60);
          setSuccessMsg("Your account is not verified yet. A new verification code has been sent to your email.");
          setPassword('');
        } else if (data.access_token) {
          onAuthSuccess(data.access_token);
          setShowAuthModal(false);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (otp.trim().length !== 6) {
      setErrorMsg("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToVerify,
          code: otp.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Verification failed.");
      }

      setSuccessMsg("Email verified successfully! Logging in...");
      if (data.access_token) {
        setTimeout(() => {
          onAuthSuccess(data.access_token);
          setShowAuthModal(false);
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected verification error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToVerify
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to resend code.");
      }

      setSuccessMsg("A new verification code has been sent to your email!");
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setContactSuccess(null);

    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      setContactError("All fields are required.");
      return;
    }

    setContactLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/v1/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim(),
          message: contactMessage.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to send message.");
      }

      setContactSuccess("Message sent successfully!");
      setContactName('');
      setContactEmail('');
      setContactMessage('');
    } catch (err: any) {
      setContactError(err.message || "An unexpected error occurred.");
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-y-auto scroll-smooth text-foreground flex flex-col font-body" style={{ backgroundColor: '#06070d' }}>
      
      {/* 1. Fullscreen Fixed Dark Fallback + Background Video */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundColor: '#06070d' }} />
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-[1] pointer-events-none"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>
      {/* Dark overlay over video to ensure text is always readable */}
      <div className="fixed inset-0 z-[2] pointer-events-none" style={{ background: 'rgba(6, 7, 13, 0.45)' }} />

      {/* 2. Glassmorphic Navigation Bar */}
      <header className="relative z-20 w-full backdrop-blur-[2px] border-b border-white/3">
        <div className="flex flex-row justify-between items-center px-8 py-6 max-w-7xl mx-auto">
          {/* Logo brand combining the custom SVG mark and 'QuantIQ' */}
          <div className="flex items-center gap-3 select-none">
            <Logo size={36} className="glow-cyan" />
            <span 
              className="text-3xl tracking-tight text-foreground font-normal"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              QuantIQ<sup className="text-xs font-sans align-super ml-0.5 opacity-80">®</sup>
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 relative">
            <a href="#hero" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Home
            </a>
            <a href="#market-movers" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Market Movers
            </a>
            <a href="#stack" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              The Stack
            </a>
            <a href="#capabilities" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Capabilities
            </a>
            <a href="#news" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              News
            </a>
            <div className="relative">
              <button 
                onClick={() => setShowReachUs(prev => !prev)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1 outline-none"
              >
                Reach Us
              </button>
              {showReachUs && (
                <div 
                  style={{ position: 'absolute', top: 'calc(100% + 12px)', left: '50%', transform: 'translateX(-50%)' }}
                  className="w-48 p-2 rounded-2xl liquid-glass border border-white/10 shadow-2xl flex flex-col gap-1 z-20"
                >
                  <a 
                    href="https://www.linkedin.com/in/karan-shelar-779381343/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={() => setShowReachUs(false)}
                    className="px-4 py-2 rounded-xl hover:bg-white/5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    LinkedIn
                  </a>
                  <a 
                    href="https://github.com/Edge-Explorer" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={() => setShowReachUs(false)}
                    className="px-4 py-2 rounded-xl hover:bg-white/5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    GitHub Profile
                  </a>
                  <a 
                    href="https://github.com/Edge-Explorer/QuantIQ" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={() => setShowReachUs(false)}
                    className="px-4 py-2 rounded-xl hover:bg-white/5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    GitHub Repository
                  </a>
                  <button 
                    onClick={() => { setShowReachUs(false); setShowContactModal(true); }}
                    className="w-full px-4 py-2 rounded-xl hover:bg-white/5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left border-t border-white/5 mt-1 pt-3 cursor-pointer outline-none"
                  >
                    Email Developer
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* CTA Trigger and Github Badge */}
          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/Edge-Explorer/QuantIQ"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground/90 hover:text-foreground transition-colors duration-200"
            >
              <GithubIcon size={18} className="text-foreground" />
              <span className="font-medium tracking-tight text-white/95">{githubStars !== null ? githubStars : 'Star'}</span>
            </a>

            {user ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={onGoToDashboard}
                  className="bg-[#046A38] text-white hover:bg-[#03522b] transition-all duration-200 px-5 py-2 text-sm font-semibold rounded-[4px] cursor-pointer shadow-md"
                >
                  Dashboard
                </button>
                {user.pictureUrl && (
                  <img 
                    src={user.pictureUrl} 
                    alt="Profile" 
                    className="w-9 h-9 rounded-full object-cover border border-white/10"
                  />
                )}
              </div>
            ) : (
              <Button 
                onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }}
                className="liquid-glass rounded-full px-6 py-2.5 text-sm text-foreground hover:scale-[1.03] transition-transform duration-200 cursor-pointer shadow-md"
              >
                Unlock Alpha
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 3. Cinematic Hero and Scrollable Content */}
      <main className="relative z-10 w-full flex flex-col items-center">
        
        {/* HERO SECTION */}
        <section id="hero" className="flex flex-col lg:flex-row justify-between items-center px-6 gap-12 max-w-7xl mx-auto w-full min-h-[90vh] py-16">
          
          {/* Left Column (Content) */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-2xl pt-8">
            {/* Heading H1 */}
            <h1 
              className="text-5xl sm:text-7xl md:text-8xl font-normal leading-[0.95] tracking-[-2.46px] text-foreground animate-fade-rise"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Where <em className="not-italic text-muted-foreground">wealth</em> rises <br />
              <em className="not-italic text-muted-foreground">through the silence.</em>
            </h1>

            {/* Subtext */}
            <p className="text-muted-foreground text-base sm:text-lg mt-8 leading-relaxed animate-fade-rise-delay font-normal">
              We're designing tools for quantitative traders, market analysts, and strategic investors. 
              Amid market noise, we build high-fidelity spaces for sharp focus and outperforming strategy.
            </p>

            {/* Large Hero CTA */}
            {user ? (
              <button 
                onClick={onGoToDashboard}
                className="bg-[#046A38] text-white hover:bg-[#03522b] rounded-full px-14 py-5 text-base mt-12 hover:scale-[1.03] cursor-pointer transition-transform duration-200 animate-fade-rise-delay-2 shadow-lg font-semibold"
              >
                Go to Dashboard
              </button>
            ) : (
              <button 
                onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }}
                className="liquid-glass rounded-full px-14 py-5 text-base text-foreground mt-12 hover:scale-[1.03] cursor-pointer transition-transform duration-200 animate-fade-rise-delay-2 shadow-lg"
              >
                Unlock Alpha
              </button>
            )}
          </div>

          {/* Right Column — Volumetric 3D CSS Book Stack */}
          <div className="flex justify-center items-center relative w-full max-w-md lg:max-w-none pt-4 lg:pt-0 animate-fade-rise-delay">
            <div
              className="book-stack-wrapper"
              onClick={handleOpenBook}
              title="Click to open the Book of QuantIQ"
            >
              {/* Volumetric 3D stacked books pile */}
              <div className="book-pile">

                {/* Book 5 (Bottom) — Antique Black/Charcoal */}
                <div
                  className="book-3d book-bottom"
                  style={{
                    '--book-width': '250px',
                    '--book-height': '190px',
                    '--cover-gradient': 'linear-gradient(135deg, #18181b 0%, #27272a 45%, #09090b 100%)',
                    '--spine-gradient': 'linear-gradient(180deg, #111113 0%, #3f3f46 50%, #09090b 100%)'
                  } as React.CSSProperties}
                >
                  <div className="book-face-bottom" />
                  <div className="book-face-spine">
                    <div className="book-spine-ridges">
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                    </div>
                    <span className="book-spine-star">✦</span>
                    <span className="book-spine-text">Quant Research</span>
                    <span className="book-spine-star">✦</span>
                  </div>

                  <div className="book-face-right-pages" />
                  <div className="book-face-front-pages" />
                  <div className="book-face-top" />
                </div>

                {/* Book 4 — Antique Amber/Brown */}
                <div
                  className="book-3d book-4"
                  style={{
                    '--book-width': '242px',
                    '--book-height': '182px',
                    '--cover-gradient': 'linear-gradient(135deg, #5f2d0a 0%, #85400f 45%, #3e1b03 100%)',
                    '--spine-gradient': 'linear-gradient(180deg, #4c2204 0%, #a16207 50%, #3e1b03 100%)'
                  } as React.CSSProperties}
                >
                  <div className="book-face-bottom" />
                  <div className="book-face-spine">
                    <div className="book-spine-ridges">
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                    </div>
                    <span className="book-spine-star">✦</span>
                    <span className="book-spine-text">Microstructure</span>
                    <span className="book-spine-star">✦</span>
                  </div>

                  <div className="book-face-right-pages" />
                  <div className="book-face-front-pages" />
                  <div className="book-face-top" />
                </div>

                {/* Book 3 — Antique Emerald/Forest Green */}
                <div
                  className="book-3d book-3"
                  style={{
                    '--book-width': '246px',
                    '--book-height': '186px',
                    '--cover-gradient': 'linear-gradient(135deg, #04382a 0%, #065f46 45%, #02241b 100%)',
                    '--spine-gradient': 'linear-gradient(180deg, #022b20 0%, #0f766e 50%, #02241b 100%)'
                  } as React.CSSProperties}
                >
                  <div className="book-face-bottom" />
                  <div className="book-face-spine">
                    <div className="book-spine-ridges">
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                    </div>
                    <span className="book-spine-star">✦</span>
                    <span className="book-spine-text">System Graph</span>
                    <span className="book-spine-star">✦</span>
                  </div>

                  <div className="book-face-right-pages" />
                  <div className="book-face-front-pages" />
                  <div className="book-face-top" />
                </div>

                {/* Book 2 — Antique Burgundy/Crimson */}
                <div
                  className="book-3d book-2"
                  style={{
                    '--book-width': '238px',
                    '--book-height': '178px',
                    '--cover-gradient': 'linear-gradient(135deg, #380707 0%, #7f1d1d 45%, #200303 100%)',
                    '--spine-gradient': 'linear-gradient(180deg, #2d0505 0%, #991b1b 50%, #200303 100%)'
                  } as React.CSSProperties}
                >
                  <div className="book-face-bottom" />
                  <div className="book-face-spine">
                    <div className="book-spine-ridges">
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                    </div>
                    <span className="book-spine-star">✦</span>
                    <span className="book-spine-text">ML Signal Engine</span>
                    <span className="book-spine-star">✦</span>
                  </div>

                  <div className="book-face-right-pages" />
                  <div className="book-face-front-pages" />
                  <div className="book-face-top" />
                </div>

                {/* Book 1 (Top Book) — Astronomical Cosmic Blue */}
                <div
                  className={`book-3d book-top${isBookAnimating ? ' is-opening' : ''}`}
                  style={{
                    '--book-width': '232px',
                    '--book-height': '172px',
                    '--cover-gradient': 'linear-gradient(135deg, #090d16 0%, #1e293b 45%, #080c14 100%)',
                    '--spine-gradient': 'linear-gradient(180deg, #05080f 0%, #334155 50%, #080c14 100%)'
                  } as React.CSSProperties}
                >
                  <div className="book-face-bottom" />
                  <div className="book-face-spine">
                    <div className="book-spine-ridges">
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                      <div className="book-spine-ridge" />
                    </div>
                    <span className="book-spine-star">✦</span>
                    <span className="book-spine-text">QuantIQ Codex</span>
                    <span className="book-spine-star">✦</span>
                  </div>

                  <div className="book-face-right-pages" />
                  <div className="book-face-front-pages" />
                  <div className="book-face-top flex items-center justify-center">
                    {/* Gold Foil Celestial Ornament */}
                    <div className="w-20 h-20 rounded-full border border-amber-500/35 flex items-center justify-center relative shadow-[0_0_15px_rgba(191,149,63,0.15)]">
                      <div className="absolute inset-1.5 rounded-full border border-dashed border-amber-500/25 animate-[spin_40s_linear_infinite]" />
                      <Logo size={36} className="relative z-10 opacity-80 filter drop-shadow-[0_0_6px_rgba(0,242,254,0.4)]" />
                    </div>
                  </div>
                </div>

              </div>


            </div>
          </div>


        </section>

        {/* MARKET MOVERS SECTION */}
        <section id="market-movers" className="w-full py-24 border-t border-white/5 flex flex-col items-center">
          <div className="max-w-7xl mx-auto px-8 w-full flex flex-col items-center">

            {/* Section Header — matches page style */}
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-3">Market Intelligence</span>
            <h2
              className="text-4xl sm:text-5xl font-normal text-foreground tracking-tight mb-4"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Market Movers
            </h2>
            <p className="text-muted-foreground max-w-xl text-sm sm:text-base mb-14 leading-relaxed text-center">
              Real-time top gainers, losers and most-active stocks.
            </p>

            {/* 3 Column Glassmorphic Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
              {[
                { key: 'gainers', label: 'Top Gainers', accent: '#10b981', borderAccent: 'rgba(16,185,129,0.2)' },
                { key: 'losers', label: 'Top Losers', accent: '#ef4444', borderAccent: 'rgba(239,68,68,0.2)' },
                { key: 'most_active', label: 'Most Active', accent: '#a78bfa', borderAccent: 'rgba(167,139,250,0.2)' },
              ].map(({ key, label, accent, borderAccent }) => {
                const items: any[] = (marketMovers as any)[key] || [];
                return (
                  <div
                    key={key}
                    className="liquid-glass rounded-2xl p-6 text-left"
                    style={{ border: `1px solid ${borderAccent}` }}
                  >
                    {/* Panel Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                      <div style={{ width: '3px', height: '14px', background: accent, borderRadius: '2px', boxShadow: `0 0 6px ${accent}80` }} />
                      <span style={{ fontSize: '10px', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                    </div>

                    {/* Stock Rows */}
                    {items.map((item, idx) => {
                      const isBull = item.changePercent >= 0;
                      return (
                        <div
                          key={item.symbol}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 0',
                            borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          }}
                        >
                          {/* Symbol + Name */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: accent, letterSpacing: '0.02em' }}>{item.symbol}</div>
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px', marginTop: '2px' }}>{item.name}</div>
                          </div>
                          {/* Sparkline */}
                          <Sparkline symbol={item.symbol} change={item.changePercent} width={54} height={22} />
                          {/* Price + % */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>${item.price.toLocaleString()}</div>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: isBull ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                              {isBull ? '+' : ''}{item.changePercent.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* TECH STACK LOGO LOOP */}
        <section className="w-full py-6 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-8 mb-5 text-center">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">Powered By</span>
          </div>
          <LogoLoop
            logos={[
              { node: <SiReact />, title: "React 19", href: "https://react.dev" },
              { node: <SiTailwindcss />, title: "Tailwind v4", href: "https://tailwindcss.com" },
              { node: <SiTypescript />, title: "TypeScript", href: "https://www.typescriptlang.org" },
              { node: <SiFastapi />, title: "FastAPI", href: "https://fastapi.tiangolo.com" },
              { node: <SiGraphql />, title: "GraphQL", href: "https://graphql.org" },
              { node: <SiPostgresql />, title: "PostgreSQL", href: "https://www.postgresql.org" },
              { node: <SiPython />, title: "Python", href: "https://www.python.org" },
              { node: <SiApachekafka />, title: "Redpanda", href: "https://redpanda.com" },
              { node: <SiRazorpay />, title: "Razorpay", href: "https://razorpay.com" },
              { node: <SiGrafana />, title: "Grafana", href: "https://grafana.com" },
            ]}
            logoSize={48}
            gap={72}
            durationSeconds={18}
          />
        </section>

        {/* THE QUANTIQ STACK INFO SECTION */}
        <section id="stack" className="w-full py-28 border-t border-white/5 flex flex-col items-center text-center bg-black/20 backdrop-blur-[1px]">
          <div className="max-w-7xl mx-auto px-8 w-full flex flex-col items-center">
            
            <span className="text-cyan-400 text-xs font-semibold uppercase tracking-widest mb-3">System Architecture</span>
            <h2 
              className="text-4xl sm:text-5xl font-normal text-foreground tracking-tight"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              The QuantIQ Technology Stack
            </h2>
            <p className="text-muted-foreground max-w-xl text-sm sm:text-base mt-4 mb-16 leading-relaxed">
              Designed for high-frequency model inference, localized intelligence, and type-safe data streaming.
            </p>

            {/* Tech Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
              
              {/* Card 1: ONNX */}
              <div className="liquid-glass rounded-2xl p-7 text-left border border-white/5 hover:border-cyan-400/20 hover:scale-[1.01] transition-all duration-300 group">
                <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-semibold block mb-1">Inference Engine</span>
                <h3 className="text-lg font-medium text-foreground mb-3">ONNX Runtime Model</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Executes localized neural network price direction predictions on the client-side stock streams with sub-millisecond execution times.
                </p>
              </div>

              {/* Card 2: Gemini */}
              <div className="liquid-glass rounded-2xl p-7 text-left border border-white/5 hover:border-purple-400/20 hover:scale-[1.01] transition-all duration-300 group">
                <span className="text-[10px] text-purple-400 uppercase tracking-widest font-semibold block mb-1">Strategic Reasoning</span>
                <h3 className="text-lg font-medium text-foreground mb-3">Gemini ReAct Agent</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Orchestrates event-driven logical reasoning loops cross-examining current indicators, alert levels, and watchlist tickers.
                </p>
              </div>

              {/* Card 3: FastAPI */}
              <div className="liquid-glass rounded-2xl p-7 text-left border border-white/5 hover:border-emerald-400/20 hover:scale-[1.01] transition-all duration-300 group">
                <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold block mb-1">Backend Core</span>
                <h3 className="text-lg font-medium text-foreground mb-3">FastAPI & Uvicorn</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  High-performance Python ASGI backend handling auth verification, database sessions, and payment order callbacks.
                </p>
              </div>

              {/* Card 4: Strawberry GraphQL */}
              <div className="liquid-glass rounded-2xl p-7 text-left border border-white/5 hover:border-cyan-400/20 hover:scale-[1.01] transition-all duration-300 group">
                <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-semibold block mb-1">Data Query & Stream</span>
                <h3 className="text-lg font-medium text-foreground mb-3">Strawberry GraphQL</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Defines type-safe schemas for queries, mutations, and WebSocket subscriptions to stream real-time price updates.
                </p>
              </div>

              {/* Card 5: Redpanda */}
              <div className="liquid-glass rounded-2xl p-7 text-left border border-white/5 hover:border-rose-400/20 hover:scale-[1.01] transition-all duration-300 group">
                <span className="text-[10px] text-rose-400 uppercase tracking-widest font-semibold block mb-1">Message Broker</span>
                <h3 className="text-lg font-medium text-foreground mb-3">Redpanda Data Stream</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ingests and queues tick-by-tick real-time stock pricing updates to provide high-throughput WebSocket broadcast streams.
                </p>
              </div>

              {/* Card 6: PostgreSQL */}
              <div className="liquid-glass rounded-2xl p-7 text-left border border-white/5 hover:border-blue-400/20 hover:scale-[1.01] transition-all duration-300 group">
                <span className="text-[10px] text-blue-400 uppercase tracking-widest font-semibold block mb-1">Persistence</span>
                <h3 className="text-lg font-medium text-foreground mb-3">PostgreSQL & SQLAlchemy</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Stores user transactions, price thresholds for alerts, user profiles, and historical stock candlesticks.
                </p>
              </div>

              {/* Card 7: Razorpay */}
              <div className="liquid-glass rounded-2xl p-7 text-left border border-white/5 hover:border-indigo-400/20 hover:scale-[1.01] transition-all duration-300 group">
                <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-semibold block mb-1">Monetization</span>
                <h3 className="text-lg font-medium text-foreground mb-3">Razorpay Checkout SDK</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enables integrated test-mode checkout payments to purchase SaaS credit packs for running Gemini Agent analyses.
                </p>
              </div>

              {/* Card 8: React & Tailwind v4 */}
              <div className="liquid-glass rounded-2xl p-7 text-left border border-white/5 hover:border-violet-400/20 hover:scale-[1.01] transition-all duration-300 group">
                <span className="text-[10px] text-violet-400 uppercase tracking-widest font-semibold block mb-1">Frontend Layer</span>
                <h3 className="text-lg font-medium text-foreground mb-3">React 19 & Tailwind v4</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Built with React's latest hooks and Tailwind's compile-time CSS engine to deliver a responsive, glassmorphic layout.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* CORE PLATFORM CAPABILITIES SECTION */}
        <section id="capabilities" className="w-full py-28 border-t border-white/5 flex flex-col items-center text-center">
          <div className="max-w-7xl mx-auto px-8 w-full flex flex-col items-center">
            
            <span className="text-purple-400 text-xs font-semibold uppercase tracking-widest mb-3">Capabilities</span>
            <h2 
              className="text-4xl sm:text-5xl font-normal text-foreground tracking-tight"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Everything you need to trade smarter
            </h2>
            <p className="text-muted-foreground max-w-xl text-sm sm:text-base mt-4 mb-16 leading-relaxed">
              QuantIQ bundles real-time market data, AI-powered analysis, and precision charting into one intelligent trading terminal.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl text-left">
              
              {/* Feature 1: AI Analyst */}
              <div className="liquid-glass rounded-3xl p-8 border border-white/5 flex flex-col justify-between hover:border-purple-400/20 hover:scale-[1.01] transition-all duration-300">
                <div>
                  <span className="text-[10px] text-purple-400 uppercase tracking-widest font-semibold block mb-3">AI Strategy Analyst</span>
                  <h3 className="text-lg font-medium text-foreground mb-3">Gemini-Powered Deep Analysis</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Ask the Gemini ReAct agent to analyze any stock. It cross-examines live indicators, price history, financial news and your watchlist signals — returning structured markdown strategy reports.
                  </p>
                </div>
                <div className="h-[2px] w-12 bg-purple-400/50 mt-6" />
              </div>

              {/* Feature 2: Interactive Charts */}
              <div className="liquid-glass rounded-3xl p-8 border border-white/5 flex flex-col justify-between hover:border-cyan-400/20 hover:scale-[1.01] transition-all duration-300">
                <div>
                  <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-semibold block mb-3">Advanced Charting</span>
                  <h3 className="text-lg font-medium text-foreground mb-3">Interactive Candlestick Charts</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Visualize any ticker with professional candlestick charts powered by Lightweight Charts. Switch between 1D, 1W, 1M, 3M, and 1Y timeframes, overlaid with RSI, MACD, Bollinger Bands and more.
                  </p>
                </div>
                <div className="h-[2px] w-12 bg-cyan-400/50 mt-6" />
              </div>

              {/* Feature 3: Price Alerts */}
              <div className="liquid-glass rounded-3xl p-8 border border-white/5 flex flex-col justify-between hover:border-emerald-400/20 hover:scale-[1.01] transition-all duration-300">
                <div>
                  <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold block mb-3">Event-Driven Alerts</span>
                  <h3 className="text-lg font-medium text-foreground mb-3">Real-Time Price Threshold Alerts</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Set upper and lower price targets on any watchlist ticker. QuantIQ continuously monitors live prices and fires instant in-app notifications the moment a threshold is breached.
                  </p>
                </div>
                <div className="h-[2px] w-12 bg-emerald-400/50 mt-6" />
              </div>

              {/* Feature 4: Watchlist */}
              <div className="liquid-glass rounded-3xl p-8 border border-white/5 flex flex-col justify-between hover:border-amber-400/20 hover:scale-[1.01] transition-all duration-300">
                <div>
                  <span className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold block mb-3">Smart Watchlist</span>
                  <h3 className="text-lg font-medium text-foreground mb-3">Global Ticker Search & Watchlist</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Search thousands of global stocks, crypto, ETFs and indices using the intelligent autocomplete. Track live prices, percentage changes and portfolio performance across your personalized watchlist.
                  </p>
                </div>
                <div className="h-[2px] w-12 bg-amber-400/50 mt-6" />
              </div>

              {/* Feature 5: Trending Hub */}
              <div className="liquid-glass rounded-3xl p-8 border border-white/5 flex flex-col justify-between hover:border-rose-400/20 hover:scale-[1.01] transition-all duration-300">
                <div>
                  <span className="text-[10px] text-rose-400 uppercase tracking-widest font-semibold block mb-3">Market Intelligence</span>
                  <h3 className="text-lg font-medium text-foreground mb-3">Trending Stocks & Financial Feed</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Stay ahead with a curated trending stocks feed and a live financial news stream. Market Movers surface the day's top gainers, losers and most-active tickers — refreshed every 60 seconds.
                  </p>
                </div>
                <div className="h-[2px] w-12 bg-rose-400/50 mt-6" />
              </div>

              {/* Feature 6: Strategy Gauge */}
              <div className="liquid-glass rounded-3xl p-8 border border-white/5 flex flex-col justify-between hover:border-indigo-400/20 hover:scale-[1.01] transition-all duration-300">
                <div>
                  <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-semibold block mb-3">Quantitative Tools</span>
                  <h3 className="text-lg font-medium text-foreground mb-3">Interactive Strategy Gauges</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Formulate bullish or bearish confidence scores using qualitative and quantitative inputs. Cross-reference ONNX model predictions, RSI levels, and watchlist signals to validate your thesis before entry.
                  </p>
                </div>
                <div className="h-[2px] w-12 bg-indigo-400/50 mt-6" />
              </div>

            </div>
          </div>
        </section>

        {/* FINANCIAL NEWS SECTION */}
        <section id="news" className="w-full py-28 border-t border-white/5 flex flex-col items-center text-center bg-black/20 backdrop-blur-[1px]">
          <div className="max-w-7xl mx-auto px-8 w-full flex flex-col items-center">

            {/* Section Header */}
            <span className="text-rose-400 text-xs font-semibold uppercase tracking-widest mb-3">Market News</span>
            <h2
              className="text-4xl sm:text-5xl font-normal text-foreground tracking-tight mb-4"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Financial Intelligence Feed
            </h2>
            <p className="text-muted-foreground max-w-xl text-sm sm:text-base mb-14 leading-relaxed">
              Stay ahead of the market with curated financial news from leading global sources.
            </p>

            {/* News Grid — 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full text-left">
              {landingNews.slice(0, 6).map((item) => {
                const categoryColors: Record<string, string> = {
                  Macro: '#f59e0b',
                  Technology: '#06b6d4',
                  Crypto: '#a78bfa',
                  Markets: '#10b981',
                  Stocks: '#3b82f6',
                  Finance: '#ec4899',
                };
                const catColor = categoryColors[item.category] || '#94a3b8';
                const CardEl = item.link ? 'a' : 'div';
                const linkProps = item.link ? { href: item.link, target: '_blank', rel: 'noopener noreferrer' } : {};
                return (
                  <CardEl
                    key={item.id}
                    {...(linkProps as any)}
                    className="liquid-glass rounded-2xl p-6 border border-white/5 flex flex-col gap-3 hover:border-white/10 hover:scale-[1.01] transition-all duration-300 group"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
                  >
                    {/* Category + Time */}
                    <div className="flex items-center justify-between">
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          color: catColor,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          background: `${catColor}18`,
                          border: `1px solid ${catColor}40`,
                          padding: '2px 8px',
                          borderRadius: '99px',
                        }}
                      >
                        {item.category}
                      </span>
                      <span className="text-[10px] text-white/30">{item.time}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-white transition-colors">
                      {item.title}
                    </h3>

                    {/* Summary */}
                    {item.summary && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                        {item.summary}
                      </p>
                    )}

                    {/* Source + Arrow */}
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                      <span className="text-[10px] font-medium" style={{ color: catColor }}>{item.source}</span>
                      {item.link && (
                        <span className="text-[10px] text-white/30 group-hover:text-white/60 transition-colors">Read →</span>
                      )}
                    </div>
                  </CardEl>
                );
              })}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="w-full py-12 border-t border-white/5 text-center text-xs text-muted-foreground bg-black/30 backdrop-blur-[2px]">
          <div className="max-w-7xl mx-auto px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="font-light">MIT License</span>
            <div className="flex gap-6 items-center">
              <a href="https://github.com/Edge-Explorer/QuantIQ" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub Repo</a>
              <a href="https://www.linkedin.com/in/karan-shelar-779381343/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">LinkedIn</a>
              <button 
                onClick={() => setShowContactModal(true)} 
                className="hover:text-foreground transition-colors cursor-pointer outline-none bg-transparent border-none text-xs text-muted-foreground"
              >
                Reach Us
              </button>
            </div>
          </div>
        </footer>

      {/* 5. Aged Parchment Book Reader Modal */}
      {isBookOpen && (
        <div className="book-overlay-backdrop">
          <div className="book-reader-container">
            {/* Close button */}
            <button className="book-close-x" onClick={handleCloseBook} aria-label="Close book">
              <X size={28} />
            </button>

            <div className="book-pages-spread">
              
              {/* LEFT PAGE (Context/Chapter Title) */}
              <div className="parchment-page-half left-page">
                {bookPage === 1 && (
                  <>
                    <h3 className="ink-heading">Chapter I: The QuantIQ Saga</h3>
                    <p className="ink-paragraph">
                      In the silent deeps of the financial oceans, most traders get lost in the deafening roar of the market. QuantIQ was born to carve out a sanctuary of sharp focus—a premium intelligence terminal that operates on pure mathematical logic.
                    </p>
                    <p className="ink-paragraph">
                      We have laid down a resilient infrastructure built to query and process stock movements with extreme accuracy. By utilizing advanced local ONNX model routing and dynamic caching, we ensure traders get high-fidelity indicators without delay or limit.
                    </p>
                    <p className="ink-paragraph italic mt-6" style={{ fontFamily: "'EB Garamond', serif" }}>
                      "Amidst the chaos and noise of the market tick, truth is revealed through the silent logic of the code."
                    </p>
                  </>
                )}

                {bookPage === 2 && (
                  <>
                    <h3 className="ink-heading">Chapter II: The Horizon</h3>
                    <p className="ink-paragraph">
                      The roadmap ahead is carved with precision. We are expanding our tactical scope to incorporate fundamental catalysts and real-time news sentiment.
                    </p>
                    <p className="ink-paragraph">
                      Our target is to build an advisor that merges macro news cycles with technical charts, providing a comprehensive, time-aware analysis for swing trading setups.
                    </p>
                    <div className="w-24 h-0.5 bg-[#8c2020]/20 my-6 mx-auto"></div>
                    <p className="ink-paragraph text-center text-sm font-semibold text-[#8c2020]">
                      Turn the page to study our core architectural engine.
                    </p>
                  </>
                )}

                {bookPage === 3 && (
                  <>
                    <h3 className="ink-heading">Chapter III: The Graph</h3>
                    <p className="ink-paragraph">
                      The core engine of QuantIQ is designed as an interconnected web of specialized nodes.
                    </p>
                    <p className="ink-paragraph">
                      Every credit transaction, price update, indicator calculation, and LLM reasoning step flows through this diagram.
                    </p>
                    <p className="ink-paragraph font-semibold text-sm mt-4 text-[#8c2020]">
                      👉 Hover over the nodes on the right page to study each component's role in the architecture.
                    </p>
                  </>
                )}

                {bookPage === 4 && (
                  <>
                    <h3 className="ink-heading">Chapter IV: The Developer's Ledger</h3>
                    <p className="ink-paragraph">
                      Thank you for reading the story of QuantIQ. This platform is actively maintained by Karan Shelar.
                    </p>
                    <p className="ink-paragraph">
                      If you have questions about the architecture, want to collaborate on quantitative models, or have design inquiries, drop a message in the ledger on the right page.
                    </p>
                    <p className="ink-paragraph">
                      The form is connected to our SMTP email dispatch server and will send a notification straight to my desk.
                    </p>
                  </>
                )}
              </div>

              {/* RIGHT PAGE (Interactive Content) */}
              <div className="parchment-page-half right-page">
                {bookPage === 1 && (
                  <>
                    <h4 className="ink-subheading">Completed Achievements</h4>
                    <div className="ink-bullet-list">
                      <div className="ink-bullet-item">
                        <span className="ink-bullet-bullet">✦</span>
                        <span><strong>Dynamic Volatility Fallback</strong>: Smart category-based ATR target calculations cached inside isolated Redis DB 1.</span>
                      </div>
                      <div className="ink-bullet-item">
                        <span className="ink-bullet-bullet">✦</span>
                        <span><strong>Multi-Model ONNX Router</strong>: Specialized RandomForest classifier models for tech equities, cryptos, and market indices.</span>
                      </div>
                      <div className="ink-bullet-item">
                        <span className="ink-bullet-bullet">✦</span>
                        <span><strong>MLOps Retraining Cron</strong>: Automated weekly retraining tasks pushing challenger ONNX models directly to Hugging Face Hub.</span>
                      </div>
                      <div className="ink-bullet-item">
                        <span className="ink-bullet-bullet">✦</span>
                        <span><strong>Closed-Market safeguards</strong>: Real-time tick filters that detect flat sessions and fallback to historical trading candles.</span>
                      </div>
                    </div>
                  </>
                )}

                {bookPage === 2 && (
                  <>
                    <h4 className="ink-subheading">Roadmap & Future Features</h4>
                    <div className="ink-bullet-list">
                      <div className="ink-bullet-item">
                        <span className="ink-bullet-bullet">✓</span>
                        <span><strong>Contextual News Sentiment</strong>: Feed Yahoo Finance news feeds to the Gemini agent to cross-reference market headlines.</span>
                      </div>
                      <div className="ink-bullet-item">
                        <span className="ink-bullet-bullet">✓</span>
                        <span><strong>Catalyst Watch</strong>: Sync next scheduled earnings dates, EPS Estimates, and Revenue consensuses.</span>
                      </div>
                      <div className="ink-bullet-item">
                        <span className="ink-bullet-bullet">☐</span>
                        <span><strong>Razorpay Subscription tiers</strong>: Commercial tier upgrades enabling unlimited strategy locks.</span>
                      </div>
                      <div className="ink-bullet-item">
                        <span className="ink-bullet-bullet">☐</span>
                        <span><strong>SMS & WhatsApp Alerts</strong>: Trigger dynamic price alert notifications straight to your phone.</span>
                      </div>
                    </div>
                  </>
                )}

                {bookPage === 3 && (
                  <div className="blueprint-container">
                    <div className="blueprint-grid-nodes">
                      {/* Row 1: Frontend */}
                      <div className="blueprint-row">
                        <div 
                          className="sketch-node-circle"
                          onMouseEnter={() => setHoveredNode('vercel')}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          <Globe size={22} className="text-[#204060]" />
                          <span className="sketch-node-label">Vercel UI</span>
                          {hoveredNode === 'vercel' && (
                            <div className="sketch-node-desc-bubble">
                              <strong>Vercel Client</strong>: React/TS web interface. Fetches user data, watchlist items, and renders active price candles.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-[#5a5246] text-[10px] font-bold">⬇ (GraphQL HTTP & WS)</div>

                      {/* Row 2: API Gateway */}
                      <div className="blueprint-row">
                        <div 
                          className="sketch-node-circle"
                          onMouseEnter={() => setHoveredNode('fastapi')}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          <span className="font-bold text-lg text-[#204060] font-serif">API</span>
                          <span className="sketch-node-label">FastAPI</span>
                          {hoveredNode === 'fastapi' && (
                            <div className="sketch-node-desc-bubble">
                              <strong>FastAPI Server</strong>: Deployed on HF Spaces. Validates credits, opens WebSocket tickers, and initiates agent requests.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-[#5a5246] text-[10px] font-bold">⬇ (Orchestration)</div>

                      {/* Row 3: Central Processing */}
                      <div className="blueprint-row gap-4">
                        <div 
                          className="sketch-node-circle"
                          onMouseEnter={() => setHoveredNode('gemini')}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          <span className="font-bold text-lg text-[#204060] font-serif">AI</span>
                          <span className="sketch-node-label">Gemini ReAct</span>
                          {hoveredNode === 'gemini' && (
                            <div className="sketch-node-desc-bubble">
                              <strong>Gemini ReAct Agent</strong>: Coordinates analysis using tool calling (news, indicators, and ML forecasts) to write swing strategy guides.
                            </div>
                          )}
                        </div>

                        <div 
                          className="sketch-node-circle"
                          onMouseEnter={() => setHoveredNode('onnx')}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          <span className="font-bold text-lg text-[#204060] font-serif">ML</span>
                          <span className="sketch-node-label">ONNX Engine</span>
                          {hoveredNode === 'onnx' && (
                            <div className="sketch-node-desc-bubble">
                              <strong>ONNX Model Router</strong>: Evaluates target indicators against Random Forest models to yield live upward probabilities.
                            </div>
                          )}
                        </div>

                        <div 
                          className="sketch-node-circle"
                          onMouseEnter={() => setHoveredNode('redis')}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          <span className="font-bold text-lg text-[#204060] font-serif">Cache</span>
                          <span className="sketch-node-label">Redis DB</span>
                          {hoveredNode === 'redis' && (
                            <div className="sketch-node-desc-bubble">
                              <strong>Redis Cache</strong>: DB 1 isolates yfinance daily indicator caches. DB 0 manages Celery tasks.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-[#5a5246] text-[10px] font-bold">⬇ (Database)</div>

                      {/* Row 4: Database */}
                      <div className="blueprint-row">
                        <div 
                          className="sketch-node-circle"
                          onMouseEnter={() => setHoveredNode('postgres')}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          <SiPostgresql size={22} className="text-[#204060]" />
                          <span className="sketch-node-label">Neon DB</span>
                          {hoveredNode === 'postgres' && (
                            <div className="sketch-node-desc-bubble">
                              <strong>Neon DB</strong>: Cloud Postgres database hosting user account data, watchlists, triggers, and prediction outcomes.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {bookPage === 4 && (
                  <div className="flex flex-col h-full justify-between">
                    <form onSubmit={handleBookContactSubmit} className="ink-form">
                      {bookFormError && (
                        <div className="text-red-600 text-xs font-semibold text-center bg-red-100 p-2 rounded">
                          {bookFormError}
                        </div>
                      )}
                      {bookFormSuccess && (
                        <div className="text-emerald-700 text-xs font-semibold text-center bg-emerald-100 p-2 rounded">
                          {bookFormSuccess}
                        </div>
                      )}
                      
                      <div className="ink-form-group">
                        <label className="ink-form-label">Your Name</label>
                        <input 
                          type="text" 
                          className="ink-form-input" 
                          value={bookName}
                          onChange={(e) => setBookName(e.target.value)}
                          required 
                        />
                      </div>
                      
                      <div className="ink-form-group">
                        <label className="ink-form-label">Email Address</label>
                        <input 
                          type="email" 
                          className="ink-form-input" 
                          value={bookEmail}
                          onChange={(e) => setBookEmail(e.target.value)}
                          required 
                        />
                      </div>
                      
                      <div className="ink-form-group">
                        <label className="ink-form-label">Ledger Entry (Message)</label>
                        <textarea 
                          className="ink-form-textarea" 
                          value={bookMessage}
                          onChange={(e) => setBookMessage(e.target.value)}
                          required
                        />
                      </div>
                      
                      <button type="submit" className="ink-submit-button" disabled={bookFormLoading}>
                        {bookFormLoading ? "Writing to Ledger..." : "Sign the Ledger"}
                      </button>
                    </form>

                    <div className="flex flex-col gap-2 mt-4">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Connect directly:</span>
                      <div className="ink-socials-grid">
                        <a 
                          href="https://www.linkedin.com/in/karan-shelar-779381343/" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="ink-social-btn"
                        >
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px' }}>
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                          </svg>
                          LinkedIn
                        </a>
                        <a 
                          href="https://github.com/Edge-Explorer" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="ink-social-btn"
                        >
                          <GithubIcon size={16} />
                          GitHub
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* BOOK NAVIGATION BUTTONS */}
              {bookPage > 1 && (
                <button className="book-page-turn-btn prev-btn" onClick={handlePrevPage}>
                  <ArrowLeft size={16} /> Prev Chapter
                </button>
              )}
              {/* Page indicator */}
              <span className="book-page-indicator">
                {['—  I  —', '—  II  —', '—  III  —', '—  IV  —'][bookPage - 1]}
              </span>
              {bookPage < 4 && (
                <button className="book-page-turn-btn next-btn" onClick={handleNextPage}>
                  Next Chapter <ArrowRight size={16} />
                </button>
              )}

            </div>
          </div>
        </div>
      )}

      </main>

      {/* 4. Glassmorphic Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-md p-8 rounded-3xl liquid-glass border border-white/10 shadow-2xl flex flex-col items-center my-8">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            {/* Logo brand in Modal */}
            <div className="flex items-center gap-3 mb-4 select-none mt-2">
              <Logo size={42} className="glow-cyan" />
              <span 
                className="text-4xl tracking-tight text-foreground"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                QuantIQ<sup className="text-xs align-super ml-0.5">®</sup>
              </span>
            </div>

            <h2 className="text-xl font-medium mb-1 text-foreground tracking-tight">
              {authMode === 'verify' ? 'Verify Email' : (authMode === 'signin' ? 'Welcome Back' : 'Create Account')}
            </h2>
            <p className="text-xs text-muted-foreground text-center mb-6 max-w-xs">
              {authMode === 'verify' 
                ? `Enter the 6-digit code sent to ${emailToVerify}`
                : (authMode === 'signin' 
                  ? 'Access your terminal to monitor watchlists and AI signals.' 
                  : 'Sign up to receive 5 free credits automatically.')}
            </p>

            {/* Feedback Messages */}
            {errorMsg && (
              <div className="w-full mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="w-full mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center font-medium">
                {successMsg}
              </div>
            )}

            {authMode === 'verify' ? (
              /* OTP Form */
              <form onSubmit={handleVerifySubmit} className="w-full flex flex-col gap-5">
                <div className="relative w-full flex flex-col gap-2">
                  <div className="relative w-full">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      type="text" 
                      maxLength={6}
                      placeholder="6-digit verification code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-white/3 border border-white/8 rounded-xl pl-11 pr-4 py-3 text-center text-lg font-bold tracking-widest text-white placeholder:text-muted-foreground placeholder:font-normal placeholder:tracking-normal outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                    />
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendCooldown > 0}
                      className="text-[11px] text-muted-foreground hover:text-white transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed bg-transparent border-none outline-none"
                    >
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend Verification Code"}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black hover:bg-white/95 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 cursor-pointer shadow-md flex justify-center items-center disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </Button>
              </form>
            ) : (
              /* Traditional Email Form */
              <form onSubmit={handleTraditionalSubmit} className="w-full flex flex-col gap-4">
                
                {authMode === 'signup' && (
                  <>
                    {/* Full Name */}
                    <div className="relative w-full">
                      <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input 
                        type="text" 
                        placeholder="Full Name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-white/3 border border-white/8 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-muted-foreground outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                      />
                    </div>

                    {/* Country */}
                    <div className="relative w-full">
                      <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input 
                        type="text" 
                        placeholder="Country (e.g. India)"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full bg-white/3 border border-white/8 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-muted-foreground outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                      />
                    </div>
                  </>
                )}

                {/* Email */}
                <div className="relative w-full">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    type="email" 
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/3 border border-white/8 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-muted-foreground outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                  />
                </div>

                {/* Password */}
                <div className="relative w-full">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/3 border border-white/8 rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-muted-foreground outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors cursor-pointer bg-transparent border-none outline-none"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {authMode === 'signup' && (
                  /* Confirm Password */
                  <div className="relative w-full">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      type={showConfirmPassword ? 'text' : 'password'} 
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white/3 border border-white/8 rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-muted-foreground outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(prev => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors cursor-pointer bg-transparent border-none outline-none"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                )}

                {/* Submit Button */}
                <Button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black hover:bg-white/95 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 cursor-pointer shadow-md flex justify-center items-center mt-2 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : (authMode === 'signin' ? 'Sign In' : 'Sign Up')}
                </Button>

              </form>
            )}

            {/* Toggle Link */}
            <div className="text-center mt-4">
              <button 
                onClick={toggleAuthMode}
                className="text-xs text-muted-foreground hover:text-white hover:underline transition-all cursor-pointer bg-transparent border-none outline-none"
              >
                {authMode === 'verify' 
                  ? "Back to Sign In"
                  : (authMode === 'signin' 
                    ? "Don't have an account? Sign Up" 
                    : "Already have an account? Sign In")}
              </button>
            </div>

            {/* Google Authentication Section */}
            {authMode !== 'verify' && (
              <>
                <div className="flex items-center justify-center gap-2 w-full my-4">
                  <span className="h-[1px] w-12 bg-white/10"></span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">or login with</span>
                  <span className="h-[1px] w-12 bg-white/10"></span>
                </div>

                {/* Google Button Container */}
                <div className="google-btn-wrapper w-full flex justify-center py-1">
                  <div ref={googleButtonRef}></div>
                </div>
              </>
            )}



          </div>
        </div>
      )}

      {/* 5. Glassmorphic Contact Form Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-md p-8 rounded-3xl liquid-glass border border-white/10 shadow-2xl flex flex-col items-center my-8">
            
            {/* Close Button */}
            <button 
              onClick={() => {
                setShowContactModal(false);
                setContactError(null);
                setContactSuccess(null);
              }}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            {/* Logo brand in Modal */}
            <div className="flex items-center gap-3 mb-2 select-none mt-2">
              <Logo size={42} className="glow-cyan" />
              <span 
                className="text-4xl tracking-tight text-foreground"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                QuantIQ<sup className="text-xs align-super ml-0.5">®</sup>
              </span>
            </div>

            <h2 className="text-xl font-medium mb-1 text-foreground tracking-tight">
              Email Developer
            </h2>
            <p className="text-xs text-muted-foreground text-center mb-6 max-w-xs">
              Send a direct message to the system developers.
            </p>

            {/* Feedback Messages */}
            {contactError && (
              <div className="w-full mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium">
                {contactError}
              </div>
            )}
            {contactSuccess && (
              <div className="w-full mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center font-medium">
                {contactSuccess}
              </div>
            )}

            {/* Contact Form */}
            <form onSubmit={handleContactSubmit} className="w-full flex flex-col gap-4">
              {/* Name */}
              <div className="relative w-full">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Your Name"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-white/3 border border-white/8 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-muted-foreground outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                />
              </div>

              {/* Email */}
              <div className="relative w-full">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="email" 
                  placeholder="Your Email Address"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-white/3 border border-white/8 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-muted-foreground outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                />
              </div>

              {/* Message */}
              <div className="relative w-full">
                <textarea 
                  placeholder="Type your message here..."
                  required
                  rows={4}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-muted-foreground outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200 resize-none min-h-[100px]"
                />
              </div>

              {/* Submit Button */}
              <Button 
                type="submit"
                disabled={contactLoading}
                className="w-full bg-white text-black hover:bg-white/95 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 cursor-pointer shadow-md flex justify-center items-center mt-2 disabled:opacity-50"
              >
                {contactLoading ? 'Sending...' : 'Send Message'}
              </Button>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
