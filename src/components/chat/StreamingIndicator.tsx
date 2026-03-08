import { BusyIndicator, Button, FlexBox } from '@ui5/webcomponents-react';

interface StreamingIndicatorProps {
  onCancel: () => void;
}

export function StreamingIndicator({ onCancel }: StreamingIndicatorProps) {
  return (
    <FlexBox
      alignItems="Center"
      justifyContent="Center"
      style={{
        padding: '0.5rem 1rem',
        gap: '0.75rem',
        background: 'var(--sapInformationBackground)',
        flexShrink: 0,
      }}
    >
      <BusyIndicator active size="S" />
      <span style={{ color: 'var(--sapTextColor)', fontSize: '0.875rem' }}>
        Agent is responding...
      </span>
      <Button design="Transparent" icon="stop" onClick={onCancel} tooltip="Stop">
        Stop
      </Button>
    </FlexBox>
  );
}
