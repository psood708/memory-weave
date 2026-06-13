'use client';
import { useCallback, useEffect, useState } from 'react';

const STEP_COUNT = 5;
const DEFAULT_STEPS: boolean[] = Array(STEP_COUNT).fill(false);

export function useOnboarding(userId: string | null) {
  const key = userId?.trim() ? `mw_onboarding_${userId}` : null;

  const [completedSteps, setCompletedSteps] = useState<boolean[]>(DEFAULT_STEPS);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Read from localStorage once the key is known (after session resolves)
  useEffect(() => {
    if (!key) return;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as boolean[];
        if (Array.isArray(parsed) && parsed.length === STEP_COUNT) {
          setCompletedSteps(parsed);
          if (!parsed.every(Boolean)) setShowOnboarding(true);
          return;
        }
      }
    } catch {}
    // First-time user: step 0 (model setup) is pre-done
    const initial = [true, false, false, false, false];
    try { localStorage.setItem(key, JSON.stringify(initial)); } catch {}
    setCompletedSteps(initial);
    setShowOnboarding(true);
  }, [key]);

  const markStepDone = useCallback((step: number) => {
    if (step < 0 || step >= STEP_COUNT) return;
    if (!key) return;
    setCompletedSteps(prev => {
      if (prev[step]) return prev; // idempotent
      const next = [...prev];
      next[step] = true;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      if (next.every(Boolean)) setShowOnboarding(false);
      return next;
    });
  }, [key]);

  return { completedSteps, showOnboarding, markStepDone };
}
