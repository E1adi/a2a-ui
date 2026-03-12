import ReactMarkdown from 'react-markdown';
import { MessageStrip, Text } from '@ui5/webcomponents-react';
import type { ChatMessage } from '../../types/index.ts';
import type { Part } from '../../services/a2a/types.ts';

interface MessageBubbleProps {
  message: ChatMessage;
  agentName?: string;
  showAgentName?: boolean;
}

function renderPart(part: Part, index: number) {
  switch (part.kind) {
    case 'text': {
      let cleanedText = part.text;
      cleanedText = cleanedText.replace(/^agent_result\s*\n+/im, '');
      cleanedText = cleanedText.replace(/^#+ agent_result\s*\n+/im, '');
      cleanedText = cleanedText.replace(/^agent_result$/im, '');
      cleanedText = cleanedText.split('\n').filter(line => !line.trim().match(/^#*\s*agent_result\s*$/i)).join('\n');
      cleanedText = cleanedText.trim();

      return (
        <div key={index} className="message-text">
          <ReactMarkdown>{cleanedText}</ReactMarkdown>
        </div>
      );
    }
    case 'file':
      return (
        <div key={index} className="message-file">
          {part.file.url ? (
            <a
              href={part.file.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--sapLinkColor)' }}
            >
              {part.file.name ?? 'Download File'}
            </a>
          ) : (
            <span>{part.file.name ?? 'File (embedded)'}</span>
          )}
          {part.file.mimeType && (
            <span style={{
              color: 'var(--sapContent_LabelColor)',
              fontSize: 'var(--sapFontSmallSize)',
              marginLeft: '0.5rem',
            }}>
              ({part.file.mimeType})
            </span>
          )}
        </div>
      );
    case 'data':
      return (
        <pre
          key={index}
          style={{
            background: 'var(--sapShell_Hover_Background)',
            border: '1px solid var(--sapField_BorderColor)',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            overflow: 'auto',
            fontFamily: 'var(--sapContent_MonospaceFontFamily)',
            fontSize: 'var(--sapFontSmallSize)',
            margin: '0.25rem 0',
          }}
        >
          {JSON.stringify(part.data, null, 2)}
        </pre>
      );
  }
}

export function MessageBubble({ message, agentName, showAgentName }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const isStreaming = message.status === 'streaming';
  const isProcessing = message.status === 'processing';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        width: '100%',
        gap: '0.25rem',
      }}
    >
      {!isUser && showAgentName && agentName && (
        <Text
          style={{
            fontSize: 'var(--sapFontSmallSize)',
            color: 'var(--sapContent_LabelColor)',
            marginLeft: '0.75rem',
            fontFamily: 'var(--sapFontSemiboldFamily)',
          }}
        >
          {agentName}
        </Text>
      )}
      <div
        className={`message-bubble ${isUser ? 'message-user' : 'message-agent'}`}
        style={{
          maxWidth: '75%',
          padding: '0.625rem 0.875rem',
          borderRadius: isUser
            ? 'var(--sapElement_BorderCornerRadius) var(--sapElement_BorderCornerRadius) 0.25rem var(--sapElement_BorderCornerRadius)'
            : 'var(--sapElement_BorderCornerRadius)',
          background: isUser
            ? 'var(--sapButton_Emphasized_Background)'
            : 'var(--sapBaseColor)',
          color: isUser
            ? 'var(--sapButton_Emphasized_TextColor)'
            : 'var(--sapTextColor)',
          border: isUser
            ? 'none'
            : '1px solid var(--sapBorderColor)',
          wordBreak: 'break-word',
        }}
      >
        {isError && (
          <MessageStrip design="Negative" hideCloseButton style={{ marginBottom: '0.5rem' }}>
            {message.error ?? 'An error occurred'}
          </MessageStrip>
        )}

        {isProcessing ? (
          <div className="message-text" style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', padding: '0.25rem 0' }}>
            {[0, 0.2, 0.4].map((delay) => (
              <span key={delay} style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--sapContent_LabelColor)',
                animation: 'pulse 1.4s infinite ease-in-out',
                animationDelay: `${delay}s`,
              }} />
            ))}
          </div>
        ) : isStreaming && message.streamingContent ? (
          <div className="message-text">
            <ReactMarkdown>{message.streamingContent}</ReactMarkdown>
            <span className="streaming-cursor" />
          </div>
        ) : message.parts.length > 0 ? (
          message.parts.map((part, i) => renderPart(part, i))
        ) : (
          <div className="message-text" style={{ fontStyle: 'italic', opacity: 0.7 }}>
            (No content)
          </div>
        )}
      </div>
    </div>
  );
}
