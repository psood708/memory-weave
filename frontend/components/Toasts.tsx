'use client';
import { Icon } from './Icon';

export interface ToastItem {
  id: number;
  text: string;
  tier: 'working' | 'episodic' | 'kg';
  score?: number;
  exit?: boolean;
}

export default function Toasts({ items }: { items: ToastItem[] }) {
  return (
    <div className="toast-stack">
      {items.map(t => (
        <div className={`toast ${t.exit ? 'exit' : ''}`} key={t.id}>
          <Icon name="sparkle" size={13} className={`star ${t.tier}`} />
          <span>{t.text}</span>
          {t.score != null && <span className="score">imp {t.score.toFixed(2)}</span>}
        </div>
      ))}
    </div>
  );
}
