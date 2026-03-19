import { useState, useCallback, type KeyboardEvent } from 'react';
import { FlexBox, TextArea, Button } from '@ui5/webcomponents-react';

interface MessageInputProps {
  onSend: (text: string) => void;
  streaming?: boolean;
  onCancel?: () => void;
  userMessageHistory?: string[];
}

export function MessageInput({ onSend, streaming, onCancel, userMessageHistory = [] }: MessageInputProps) {
  const [text, setText] = useState('');
  // -1 means "draft" (current unsent input), 0 = most recent sent message, 1 = second most recent, etc.
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draft, setDraft] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    setHistoryIndex(-1);
    setDraft('');
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !streaming) {
      e.preventDefault();
      handleSend();
      return;
    }

    if (e.key === 'ArrowUp' && userMessageHistory.length > 0) {
      e.preventDefault();
      if (historyIndex === -1) {
        // Save current input as draft before navigating
        setDraft(text);
        setHistoryIndex(0);
        setText(userMessageHistory[userMessageHistory.length - 1]);
      } else if (historyIndex < userMessageHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setText(userMessageHistory[userMessageHistory.length - 1 - newIndex]);
      }
      return;
    }

    if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault();
      if (historyIndex === 0) {
        // Back to draft
        setHistoryIndex(-1);
        setText(draft);
      } else {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setText(userMessageHistory[userMessageHistory.length - 1 - newIndex]);
      }
      return;
    }
  }, [text, historyIndex, draft, userMessageHistory, streaming]);

  const handleInput = (value: string) => {
    setText(value);
    // Reset history navigation when user types manually
    if (historyIndex !== -1) {
      setHistoryIndex(-1);
      setDraft('');
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
      borderTop: 'none',
      boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.04)',
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
          onInput={(e) => handleInput(e.target.value)}
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
