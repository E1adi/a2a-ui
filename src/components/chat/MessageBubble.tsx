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
    case 'text':
      // Remove "agent_result" prefix if present
      let cleanedText = part.text;

      // Remove various forms of agent_result
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
            <span style={{ color: 'var(--sapContent_LabelColor)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
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
            background: 'var(--sapField_Background)',
            padding: '0.5rem',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '0.8125rem',
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
            fontSize: '0.75rem',
            color: 'var(--sapContent_LabelColor)',
            marginLeft: '0.5rem',
            fontWeight: 500,
          }}
        >
          {agentName}
        </Text>
      )}
      <div
        className={`message-bubble ${isUser ? 'message-user' : 'message-agent'}`}
        style={{
          maxWidth: '75%',
          padding: '0.75rem 1rem',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser
            ? 'var(--sapButton_Emphasized_Background)'
            : 'var(--sapGroup_ContentBackground)',
          color: isUser
            ? 'var(--sapButton_Emphasized_TextColor)'
            : 'var(--sapTextColor)',
          boxShadow: 'var(--sapContent_Shadow0)',
          wordBreak: 'break-word',
        }}
      >
        {isError && (
          <MessageStrip design="Negative" hideCloseButton style={{ marginBottom: '0.5rem' }}>
            {message.error ?? 'An error occurred'}
          </MessageStrip>
        )}

        {isProcessing ? (
          <div className="message-text" style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <span className="dot-animation" style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--sapContent_LabelColor)',
              animation: 'pulse 1.4s infinite ease-in-out',
              animationDelay: '0s'
            }} />
            <span className="dot-animation" style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--sapContent_LabelColor)',
              animation: 'pulse 1.4s infinite ease-in-out',
              animationDelay: '0.2s'
            }} />
            <span className="dot-animation" style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--sapContent_LabelColor)',
              animation: 'pulse 1.4s infinite ease-in-out',
              animationDelay: '0.4s'
            }} />
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
