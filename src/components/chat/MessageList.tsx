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

  // Determine if we should show agent name on status indicator
  const lastMessage = messages[messages.length - 1];
  const showAgentNameOnStatus = !lastMessage || lastMessage.role !== 'agent';

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        background: 'var(--sapBackgroundColor)',
      }}
    >
      {messages.map((msg, index) => {
        // Show agent name only on first agent message in a consecutive series
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
            .filter((artifact) => artifact.name !== 'agent_result')
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
  );
}
