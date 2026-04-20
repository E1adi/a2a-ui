import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../types/index.ts';
import type { Artifact } from '../../services/a2a/types.ts';
import type { AgentConfig } from '../../types/index.ts';
import { MessageBubble } from './MessageBubble.tsx';
import { ArtifactRenderer } from './ArtifactRenderer.tsx';
import { StatusIndicator } from './StatusIndicator.tsx';

interface MessageListProps {
  messages: ChatMessage[];
  artifacts: Artifact[];
  agent?: AgentConfig;
  currentStatus?: string;
}

export function MessageList({ messages, artifacts, agent, currentStatus }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, artifacts, currentStatus]);

  const agentName = agent?.agentCard?.name;

  const lastMessage = messages[messages.length - 1];
  const showAgentNameOnStatus = !lastMessage || lastMessage.role !== 'agent';

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--sapBackgroundColor)',
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '1rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          minHeight: '100%',
        }}
      >
        {messages.map((msg, index) => {
          const showAgentName = msg.role === 'agent' &&
            (index === 0 || messages[index - 1].role !== 'agent');

          return (
            <MessageBubble
              key={msg.messageId}
              message={msg}
              agentName={msg.role === 'agent' ? agentName : undefined}
              showAgentName={showAgentName}
            />
          );
        })}
        {artifacts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {artifacts
              .filter((artifact) => {
                // Skip artifacts that are just duplicates of the agent message text
                if (artifact.name === 'agent_result' || artifact.name === 'result') return false;
                // Skip text-only artifacts whose content already appears in messages
                const allText = artifact.parts.every((p) => p.kind === 'text');
                if (allText) {
                  const artifactText = artifact.parts.map((p) => p.kind === 'text' ? p.text : '').join('');
                  const isDuplicate = messages.some(
                    (m) => m.role === 'agent' && m.parts.some((p) => p.kind === 'text' && p.text === artifactText),
                  );
                  if (isDuplicate) return false;
                }
                return true;
              })
              .map((artifact) => (
                <ArtifactRenderer key={artifact.artifactId} artifact={artifact} />
              ))}
          </div>
        )}
        {currentStatus && (
          <StatusIndicator
            statusText={currentStatus}
            agentName={showAgentNameOnStatus ? agentName : undefined}
          />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
