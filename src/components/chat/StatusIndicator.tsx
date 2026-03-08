import { FlexBox, Text } from '@ui5/webcomponents-react';

interface StatusIndicatorProps {
  statusText: string;
  agentName?: string;
}

export function StatusIndicator({ statusText, agentName }: StatusIndicatorProps) {
  return (
    <FlexBox
      direction="Column"
      style={{
        padding: '0.5rem 1rem',
        gap: '0.25rem',
        alignItems: 'flex-start',
      }}
    >
      {agentName && (
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
      <FlexBox
        alignItems="Center"
        style={{
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '8px',
          background: 'rgba(var(--sapContent_ForegroundColor_RGB, 50, 54, 58), 0.04)',
        }}
      >
        <FlexBox style={{ gap: '0.25rem', alignItems: 'center' }}>
          <span
            className="dot-animation"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--sapContent_LabelColor)',
              animation: 'pulse 1.4s infinite ease-in-out',
              animationDelay: '0s',
            }}
          />
          <span
            className="dot-animation"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--sapContent_LabelColor)',
              animation: 'pulse 1.4s infinite ease-in-out',
              animationDelay: '0.2s',
            }}
          />
          <span
            className="dot-animation"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--sapContent_LabelColor)',
              animation: 'pulse 1.4s infinite ease-in-out',
              animationDelay: '0.4s',
            }}
          />
        </FlexBox>
        <Text
          style={{
            fontSize: '0.875rem',
            color: 'var(--sapContent_LabelColor)',
            fontStyle: 'italic',
          }}
        >
          {statusText}
        </Text>
      </FlexBox>
    </FlexBox>
  );
}
