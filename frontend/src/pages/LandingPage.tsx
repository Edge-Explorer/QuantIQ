import { useEffect, useRef, useState } from 'react';
import Logo from '../components/Logo';
import { Button } from '../components/ui/button';
import { X, ArrowRight, Eye, EyeOff, Lock, Mail, User, Globe } from 'lucide-react';

interface LandingPageProps {
  onGoogleLogin: (response: any) => Promise<void>;
  googleClientId: string;
  onAuthSuccess: (token: string) => void;
  apiUrl: string;
}

type AuthMode = 'signin' | 'signup';

export default function LandingPage({ onGoogleLogin, googleClientId, onAuthSuccess, apiUrl }: LandingPageProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  
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
  
  const googleButtonRef = useRef<HTMLDivElement>(null);

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
    setAuthMode(prev => prev === 'signin' ? 'signup' : 'signin');
    setErrorMsg(null);
    setSuccessMsg(null);
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

        setSuccessMsg("Account created successfully!");
        if (data.access_token) {
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

        if (data.access_token) {
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

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground flex flex-col font-body">
      
      {/* 1. Fullscreen Loop Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>

      {/* 2. Glassmorphic Navigation Bar */}
      <header className="relative z-10 w-full">
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
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm font-medium text-foreground transition-colors">
              Home
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Studio
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              About
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Journal
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Reach Us
            </a>
          </nav>

          {/* CTA Trigger */}
          <Button 
            onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }}
            className="liquid-glass rounded-full px-6 py-2.5 text-sm text-foreground hover:scale-[1.03] transition-transform duration-200 cursor-pointer shadow-md"
          >
            Unlock Alpha
          </Button>
        </div>
      </header>

      {/* 3. Cinematic Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-6 text-center max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center max-w-5xl pt-12">
          {/* Heading H1 */}
          <h1 
            className="text-5xl sm:text-7xl md:text-8xl font-normal leading-[0.95] tracking-[-2.46px] text-foreground animate-fade-rise"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Where <em className="not-italic text-muted-foreground">wealth</em> rises <br />
            <em className="not-italic text-muted-foreground">through the silence.</em>
          </h1>

          {/* Subtext */}
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mt-8 leading-relaxed animate-fade-rise-delay font-normal">
            We're designing tools for quantitative traders, market analysts, and strategic investors. 
            Amid market noise, we build high-fidelity spaces for sharp focus and outperforming strategy.
          </p>

          {/* Large Hero CTA */}
          <button 
            onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }}
            className="liquid-glass rounded-full px-14 py-5 text-base text-foreground mt-12 hover:scale-[1.03] cursor-pointer transition-transform duration-200 animate-fade-rise-delay-2 shadow-lg"
          >
            Unlock Alpha
          </button>
        </div>
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
              {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-xs text-muted-foreground text-center mb-6 max-w-xs">
              {authMode === 'signin' 
                ? 'Access your terminal to monitor watchlists and AI signals.' 
                : 'Sign up to receive 5 free credits automatically.'}
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

            {/* Traditional Email Form */}
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors cursor-pointer"
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors cursor-pointer"
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

            {/* Toggle Link */}
            <div className="text-center mt-4">
              <button 
                onClick={toggleAuthMode}
                className="text-xs text-muted-foreground hover:text-white hover:underline transition-all cursor-pointer"
              >
                {authMode === 'signin' 
                  ? "Don't have an account? Sign Up" 
                  : "Already have an account? Sign In"}
              </button>
            </div>

            {/* Google Authentication Section */}
            <div className="flex items-center justify-center gap-2 w-full my-4">
              <span className="h-[1px] w-12 bg-white/10"></span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">or login with</span>
              <span className="h-[1px] w-12 bg-white/10"></span>
            </div>

            {/* Google Button Container */}
            <div className="google-btn-wrapper w-full flex justify-center py-1">
              <div ref={googleButtonRef}></div>
            </div>

            {/* Footer Trust Details */}
            <div className="mt-6 flex flex-col gap-1.5 w-full text-center">
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <ArrowRight size={10} className="text-cyan-400" />
                <span>Secure payment transactions verified by Razorpay</span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
