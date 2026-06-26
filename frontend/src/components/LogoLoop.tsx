import { useRef, useEffect, useState } from 'react';
import './LogoLoop.css';

interface LogoItem {
  node: React.ReactNode;
  title?: string;
  href?: string;
}

interface LogoLoopProps {
  logos: LogoItem[];
  speed?: number;
  logoHeight?: number;
  gap?: number;
  ariaLabel?: string;
}

export default function LogoLoop({ logos, speed = 30, logoHeight = 36, gap = 80, ariaLabel = 'Technology logos' }: LogoLoopProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(20);

  // Measure one set of logos and calculate animation duration
  useEffect(() => {
    if (trackRef.current) {
      const firstSet = trackRef.current.querySelector('.logoloop__set') as HTMLElement;
      if (firstSet) {
        const width = firstSet.scrollWidth;
        // duration = width / speed (pixels per second)
        setDuration(Math.max(5, width / speed));
      }
    }
  }, [logos, speed, gap]);

  const logoSet = logos.map((item, i) => (
    <li key={i} className="logoloop__item" style={{ marginRight: `${gap}px`, fontSize: `${logoHeight}px` }}>
      {item.href ? (
        <a href={item.href} target="_blank" rel="noopener noreferrer" className="logoloop__link" title={item.title}>
          <span className="logoloop__node">{item.node}</span>
        </a>
      ) : (
        <span className="logoloop__node" title={item.title}>{item.node}</span>
      )}
    </li>
  ));

  return (
    <div className="logoloop" role="region" aria-label={ariaLabel}>
      <div
        ref={trackRef}
        className="logoloop__track"
        style={{ animationDuration: `${duration}s` }}
      >
        <ul className="logoloop__set">{logoSet}</ul>
        <ul className="logoloop__set" aria-hidden="true">{logoSet}</ul>
      </div>
    </div>
  );
}
