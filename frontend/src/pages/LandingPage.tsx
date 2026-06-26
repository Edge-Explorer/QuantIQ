import { useEffect, useRef, useState } from 'react';
import Logo from '../components/Logo';
import { Button } from '../components/ui/button';
import { X, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onGoogleLogin: (response: any) => Promise<void>;
  googleClientId: string;
}

export default function LandingPage({ onGoogleLogin, googleClientId }: LandingPageProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
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
  }, [onGoogleLogin, googleClientId, showAuthModal]);

  // Re-run script loader whenever modal opens to render the Google Button
  useEffect(() => {
    if (showAuthModal && window.google && googleButtonRef.current) {
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'filled_blue',
        size: 'large',
        width: 280,
      });
    }
  }, [showAuthModal]);

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
            onClick={() => setShowAuthModal(true)}
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
            onClick={() => setShowAuthModal(true)}
            className="liquid-glass rounded-full px-14 py-5 text-base text-foreground mt-12 hover:scale-[1.03] cursor-pointer transition-transform duration-200 animate-fade-rise-delay-2 shadow-lg"
          >
            Unlock Alpha
          </button>
        </div>
      </main>

      {/* 4. Glassmorphic Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md p-8 rounded-3xl liquid-glass border border-white/10 shadow-2xl flex flex-col items-center">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            {/* Logo brand in Modal */}
            <div className="flex items-center gap-3 mb-6 select-none mt-2">
              <Logo size={42} className="glow-cyan" />
              <span 
                className="text-4xl tracking-tight text-foreground"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                QuantIQ<sup className="text-xs align-super ml-0.5">®</sup>
              </span>
            </div>

            <h2 className="text-xl font-medium mb-2 text-foreground tracking-tight">Access the Platform</h2>
            <p className="text-sm text-muted-foreground text-center mb-8 max-w-xs">
              Welcome. Connect your workspace to unlock advanced quantitative stock analysis.
            </p>

            {/* Auth Providers */}
            <div className="flex flex-col gap-4 w-full items-center">
              
              {/* Google Button Container */}
              <div className="google-btn-wrapper w-full flex justify-center py-1">
                <div ref={googleButtonRef}></div>
              </div>

            </div>

            <div className="mt-8 flex flex-col gap-2 w-full text-center">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <ArrowRight size={10} className="text-cyan-400" />
                <span>Secure checkout via Razorpay Checkout</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <ArrowRight size={10} className="text-cyan-400" />
                <span>Real-time market insights & AI analyst loop</span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
