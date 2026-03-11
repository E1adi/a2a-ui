import { ShellBar, FlexBox } from '@ui5/webcomponents-react';
import { Sidebar } from './Sidebar.tsx';
import { ChatView } from '../chat/ChatView.tsx';
import { useAppInit } from '../../hooks/useAppInit.ts';

export function AppShell() {
  useAppInit();

  return (
    <FlexBox direction="Column" style={{ height: '100vh' }}>
      <ShellBar primaryTitle="A2A Agent Chat" />
      <FlexBox direction="Row" style={{ flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <FlexBox direction="Column" style={{ flex: 1, overflow: 'hidden' }}>
          <ChatView />
        </FlexBox>
      </FlexBox>
    </FlexBox>
  );
}
