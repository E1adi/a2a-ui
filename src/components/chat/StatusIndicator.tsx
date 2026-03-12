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
        padding: '0.25rem 0',
        gap: '0.25rem',
        alignItems: 'flex-start',
      }}
    >
      {agentName && (
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
      <FlexBox
        alignItems="Center"
        style={{
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '999px',
          background: 'var(--sapInformationBackground)',
          border: '1px solid var(--sapInformativeBorderColor, var(--sapInformativeColor))',
        }}
      >
        <FlexBox style={{ gap: '0.25rem', alignItems: 'center' }}>
          {[0, 0.2, 0.4].map((delay) => (
            <span
              key={delay}
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: 'var(--sapInformativeColor)',
                animation: 'pulse 1.4s infinite ease-in-out',
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </FlexBox>
        <Text
          style={{
            fontSize: 'var(--sapFontSmallSize)',
            color: 'var(--sapInformativeTextColor)',
          }}
        >
          {statusText}
        </Text>
      </FlexBox>
    </FlexBox>
  );
}
