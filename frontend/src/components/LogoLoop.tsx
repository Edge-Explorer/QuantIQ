import type { ReactNode } from 'react';
import './LogoLoop.css';

interface LogoItem {
  node: ReactNode;
  title?: string;
  href?: string;
}

interface LogoLoopProps {
  logos: LogoItem[];
  durationSeconds?: number;
  logoSize?: number;
  gap?: number;
}

export default function LogoLoop({ logos, durationSeconds = 20, logoSize = 48, gap = 64 }: LogoLoopProps) {
  const renderSet = (key: string, hidden: boolean) => (
    <div className="logoloop-set" aria-hidden={hidden} key={key}>
      {logos.map((item, i) => (
        <div className="logoloop-item" key={i} style={{ fontSize: `${logoSize}px`, marginRight: `${gap}px` }}>
          {item.href ? (
            <a href={item.href} target="_blank" rel="noopener noreferrer" title={item.title}>
              {item.node}
            </a>
          ) : (
            <span title={item.title}>{item.node}</span>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="logoloop-wrapper">
      <div className="logoloop-track" style={{ animationDuration: `${durationSeconds}s` }}>
        {renderSet('a', false)}
        {renderSet('b', true)}
        {renderSet('c', true)}
        {renderSet('d', true)}
      </div>
    </div>
  );
}
