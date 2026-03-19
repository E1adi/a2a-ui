import { Avatar, FlexBox, Title, Label, Tag } from '@ui5/webcomponents-react';
import type { AgentConfig } from '../../types/index.ts';

interface AgentCardHeaderProps {
  agent: AgentConfig;
}

export function AgentCardHeader({ agent }: AgentCardHeaderProps) {
  const card = agent.agentCard;
  const name = agent.displayName || card?.name || 'Agent';
  const initial = name.charAt(0).toUpperCase();

  return (
    <FlexBox
      alignItems="Center"
      style={{
        padding: '0.625rem 1rem',
        gap: '0.75rem',
        borderBottom: 'none',
        boxShadow: 'var(--sapContent_Shadow0)',
        background: 'var(--sapGroup_ContentBackground)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'color-mix(in srgb, var(--sapSelectedColor) 8%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Avatar initials={initial} size="XS" colorScheme="Accent6" />
      </div>
      <FlexBox direction="Column" style={{ gap: '0.125rem', flex: 1, minWidth: 0 }}>
        <Title level="H5" style={{ fontSize: 'var(--sapFontLargeSize)', fontFamily: 'var(--sapFontSemiboldFamily)' }}>{name}</Title>
        {card?.description && (
          <Label style={{
            color: 'var(--sapContent_LabelColor)',
            fontSize: 'var(--sapFontSmallSize)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {card.description}
          </Label>
        )}
      </FlexBox>
      <FlexBox style={{ gap: '0.25rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
