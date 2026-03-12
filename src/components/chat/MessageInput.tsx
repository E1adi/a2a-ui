import { useState, type KeyboardEvent } from 'react';
import { FlexBox, TextArea, Button } from '@ui5/webcomponents-react';

interface MessageInputProps {
  onSend: (text: string) => void;
  streaming?: boolean;
  onCancel?: () => void;
}

export function MessageInput({ onSend, streaming, onCancel }: MessageInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !streaming) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleButtonClick = () => {
    if (streaming && onCancel) {
      onCancel();
    } else {
      handleSend();
    }
  };

  return (
    <div style={{
      padding: '0.75rem 1rem',
      background: 'var(--sapGroup_ContentBackground)',
      borderTop: '1px solid var(--sapBorderColor)',
      flexShrink: 0,
    }}>
      <FlexBox
        alignItems="End"
        style={{
          gap: '0.5rem',
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        <TextArea
          value={text}
          onInput={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          rows={1}
          growing
          growingMaxRows={6}
          disabled={streaming}
          style={{ flex: 1 }}
        />
        <Button
          design={streaming ? 'Negative' : 'Emphasized'}
          icon={streaming ? 'decline' : 'paper-plane'}
          onClick={handleButtonClick}
          disabled={!streaming && !text.trim()}
          tooltip={streaming ? 'Cancel' : 'Send Message'}
          style={{ flexShrink: 0 }}
        />
      </FlexBox>
    </div>
  );
}
