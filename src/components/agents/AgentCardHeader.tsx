import { Avatar, FlexBox, Title, Label, Tag } from '@ui5/webcomponents-react';
import type { AgentConfig } from '../../types/index.ts';

interface AgentCardHeaderProps {
  agent: AgentConfig;
}

export function AgentCardHeader({ agent }: AgentCardHeaderProps) {
  const card = agent.agentCard;
  const name = card?.name ?? 'Agent';
  const initial = name.charAt(0).toUpperCase();

  return (
    <FlexBox
      alignItems="Center"
      style={{
        padding: '0.75rem 1rem',
        gap: '0.75rem',
        borderBottom: '1px solid var(--sapBorderColor)',
        background: 'var(--sapGroup_ContentBackground)',
        flexShrink: 0,
      }}
    >
      <Avatar initials={initial} size="S" colorScheme="Accent6" />
      <FlexBox direction="Column" style={{ gap: '0.125rem', flex: 1 }}>
        <Title level="H5">{name}</Title>
        {card?.description && (
          <Label style={{ color: 'var(--sapContent_LabelColor)' }}>
            {card.description}
          </Label>
        )}
      </FlexBox>
      <FlexBox style={{ gap: '0.25rem' }}>
        {card?.capabilities?.streaming && (
          <Tag colorScheme="8">Streaming</Tag>
        )}
        {card?.skills?.map((skill) => (
          <Tag key={skill.id} colorScheme="6">
            {skill.name}
          </Tag>
        ))}
      </FlexBox>
    </FlexBox>
  );
}
