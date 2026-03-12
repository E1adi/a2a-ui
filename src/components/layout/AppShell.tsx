import { FlexBox } from '@ui5/webcomponents-react';
import { Sidebar } from './Sidebar.tsx';
import { ChatView } from '../chat/ChatView.tsx';
import { useAppInit } from '../../hooks/useAppInit.ts';

export function AppShell() {
  useAppInit();

  return (
    <FlexBox direction="Column" style={{ height: '100vh' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0 1.25rem',
          height: '44px',
          background: 'linear-gradient(135deg, var(--sapBrandColor), color-mix(in srgb, var(--sapBrandColor) 75%, var(--sapHighlightColor)))',
          color: 'var(--sapContent_ContrastTextColor)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
          zIndex: 1,
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.9 }}>
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="2" />
          <path d="M10.5 9.5L13.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span
          style={{
            fontFamily: 'var(--sapFontSemiboldFamily)',
            fontSize: 'var(--sapFontLargeSize)',
            letterSpacing: '0.01em',
          }}
        >
          A2A Agent Chat
        </span>
      </div>
      <FlexBox direction="Row" style={{ flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <FlexBox direction="Column" style={{ flex: 1, overflow: 'hidden' }}>
          <ChatView />
        </FlexBox>
      </FlexBox>
    </FlexBox>
  );
}
