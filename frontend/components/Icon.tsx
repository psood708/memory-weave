'use client';
import * as React from 'react';

export type IconName =
  | 'chev-down' | 'chev-right' | 'chev-left' | 'search' | 'plus' | 'minus' | 'focus' | 'refresh'
  | 'send' | 'clip' | 'web' | 'coin' | 'clock' | 'graph' | 'star' | 'sparkle'
  | 'close' | 'expand' | 'arrow-up' | 'arrow-down' | 'menu' | 'cog' | 'history'
  | 'panel-left' | 'panel-right';

export function Icon({
  name,
  size = 14,
  ...rest
}: { name: IconName; size?: number } & React.SVGProps<SVGSVGElement>) {
  const s = size;
  const common = {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  };
  switch (name) {
    case 'chev-down':  return <svg {...common}><polyline points="6 9 12 15 18 9" /></svg>;
    case 'chev-right': return <svg {...common}><polyline points="9 6 15 12 9 18" /></svg>;
    case 'search':     return <svg {...common}><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.65" y2="16.65" /></svg>;
    case 'plus':       return <svg {...common}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
    case 'minus':      return <svg {...common}><line x1="5" y1="12" x2="19" y2="12" /></svg>;
    case 'focus':      return <svg {...common}><circle cx="12" cy="12" r="3" /><line x1="12" y1="3" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="21" /><line x1="3" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="21" y2="12" /></svg>;
    case 'refresh':    return <svg {...common}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M20.49 15A9 9 0 0 1 5.64 18.36L1 14" /></svg>;
    case 'send':       return <svg {...common}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
    case 'clip':       return <svg {...common}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;
    case 'web':        return <svg {...common}><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a14 14 0 010 18 14 14 0 010-18" /></svg>;
    case 'coin':       return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v10" /><path d="M9 9h4.5a1.5 1.5 0 010 3H9v3h5" /></svg>;
    case 'clock':      return <svg {...common}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>;
    case 'graph':      return <svg {...common}><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><line x1="6" y1="6" x2="12" y2="18" /><line x1="18" y1="6" x2="12" y2="18" /><line x1="6" y1="6" x2="18" y2="6" /></svg>;
    case 'star':       return <svg {...common}><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" /></svg>;
    case 'sparkle':    return <svg {...common}><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>;
    case 'close':      return <svg {...common}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>;
    case 'expand':     return <svg {...common}><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>;
    case 'arrow-up':   return <svg {...common}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>;
    case 'arrow-down': return <svg {...common}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>;
    case 'menu':       return <svg {...common}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>;
    case 'cog':        return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06A1.7 1.7 0 0015 19.4a1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09A1.7 1.7 0 009 19.4a1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09A1.7 1.7 0 0015 4.6a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9c.06.16.1.34.1.51v.49a2 2 0 110 4h-.09c-.17 0-.35.04-.51.1z" /></svg>;
    case 'history':    return <svg {...common}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /><line x1="12" y1="7" x2="12" y2="12" /><line x1="12" y1="12" x2="15" y2="14" /></svg>;
    case 'panel-left':
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" /></svg>;
    case 'panel-right':
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="15" y1="4" x2="15" y2="20" /></svg>;
    case 'chev-left':
      return <svg {...common}><polyline points="15 18 9 12 15 6" /></svg>;
    default: return null;
  }
}

export function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="bm-g" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="0.55" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#f5a524" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" stroke="url(#bm-g)" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="6.5" stroke="rgba(167, 139, 250, 0.6)" strokeWidth="1" />
      <circle cx="12" cy="12" r="2.5" fill="url(#bm-g)" />
      <circle cx="12" cy="2" r="1.6" fill="#2dd4bf" />
      <circle cx="22" cy="14" r="1.6" fill="#a78bfa" />
      <circle cx="4" cy="18" r="1.6" fill="#f5a524" />
      <line x1="12" y1="12" x2="12" y2="2" stroke="rgba(45,212,191,0.5)" strokeWidth="0.8" />
      <line x1="12" y1="12" x2="22" y2="14" stroke="rgba(167,139,250,0.5)" strokeWidth="0.8" />
      <line x1="12" y1="12" x2="4" y2="18" stroke="rgba(245,165,36,0.5)" strokeWidth="0.8" />
    </svg>
  );
}
