'use client';
import Link from 'next/link';
import Docs from '@/components/Docs';
import { BrandMark } from '@/components/Icon';

export default function DocsPage() {
  return (
    <div style={{ background: 'var(--bg-0)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Minimal topbar — no auth required */}
      <header style={{
        height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: '1px solid var(--line-1)',
        background: 'rgba(7,9,13,0.85)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <BrandMark />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)', letterSpacing: '-0.02em' }}>
            MemoryWeave
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: 'var(--fg-4)',
            background: 'var(--bg-3)', border: '1px solid var(--line-2)',
            borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
          }}>
            DOCS
          </span>
        </Link>
        <Link
          href="/dashboard"
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--episodic)',
            textDecoration: 'none', padding: '5px 12px',
            border: '1px solid color-mix(in srgb, var(--episodic) 35%, transparent)',
            borderRadius: 6, background: 'color-mix(in srgb, var(--episodic) 8%, transparent)',
          }}
        >
          Open dashboard →
        </Link>
      </header>

      {/* Docs content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Docs />
      </div>
    </div>
  );
}
