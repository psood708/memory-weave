'use client';
import { useState } from 'react';
import App from '@/components/App';
import LandingPage from '@/components/LandingPage';

export default function Page() {
  const [view, setView] = useState<'landing' | 'dashboard' | 'evals'>('landing');

  if (view === 'landing') {
    return <LandingPage onEnter={(v) => setView(v)} />;
  }
  return <App initialTab={view === 'evals' ? 'evals' : 'conversation'} />;
}
