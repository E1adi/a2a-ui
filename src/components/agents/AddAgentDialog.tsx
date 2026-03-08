import { useState, useCallback } from 'react';
import {
  Dialog,
  Button,
  Bar,
  Input,
  Label,
  Panel,
  FlexBox,
  MessageStrip,
  BusyIndicator,
  Switch,
  Text,
} from '@ui5/webcomponents-react';
import { useAgents } from '../../hooks/useAgents.ts';
import type { AgentCard } from '../../services/a2a/types.ts';
import type { OidcConfig } from '../../types/index.ts';

interface AddAgentDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddAgentDialog({ open, onClose }: AddAgentDialogProps) {
  const { saveAgent, discoverAgent, discovering, discoveryError } = useAgents();

  const [agentUrl, setAgentUrl] = useState('');
  const [agentCard, setAgentCard] = useState<AgentCard | null>(null);
  const [useProxy, setUseProxy] = useState(true);

  // OIDC fields
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scopes, setScopes] = useState('');
  const [tokenEndpoint, setTokenEndpoint] = useState('');

  const resetForm = useCallback(() => {
    setAgentUrl('');
    setAgentCard(null);
    setUseProxy(true);
    setIssuerUrl('');
    setClientId('');
    setClientSecret('');
    setScopes('');
    setTokenEndpoint('');
  }, []);

  const handleDiscover = async () => {
    const card = await discoverAgent(agentUrl.trim(), useProxy);
    if (card) setAgentCard(card);
  };

  const handleSave = async () => {
    // Re-discover before saving to ensure we have the latest agent card
    const card = await discoverAgent(agentUrl.trim(), useProxy);
    if (!card) {
      // Discovery failed, don't save
      return;
    }

    const auth: OidcConfig | undefined =
      clientId.trim()
        ? {
            issuerUrl: issuerUrl.trim(),
            clientId: clientId.trim(),
            clientSecret: clientSecret.trim() || undefined,
            scopes: scopes.trim(),
            tokenEndpoint: tokenEndpoint.trim() || undefined,
          }
        : undefined;

    const effectiveUrl = card.url.trim();
    const result = saveAgent(effectiveUrl, card, auth, useProxy);

    // Only close dialog if save succeeded (result is not null)
    if (result) {
      resetForm();
      onClose();
    }
    // If result is null, the error will be shown via discoveryError
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      headerText="Add Agent"
      footer={
        <Bar
          endContent={
            <FlexBox style={{ gap: '0.5rem' }}>
              <Button design="Transparent" onClick={handleClose}>
                Cancel
              </Button>
              <Button design="Emphasized" onClick={handleSave} disabled={!agentCard || discovering}>
                Save
              </Button>
            </FlexBox>
          }
        />
      }
      style={{ width: 'min(560px, 90vw)' }}
    >
      <FlexBox direction="Column" style={{ gap: '1rem', padding: '1rem' }}>
        {/* Agent Discovery */}
        <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
          <Label required>Agent Base URL</Label>
          <FlexBox style={{ gap: '0.5rem' }}>
            <Input
              placeholder="https://agent.example.com"
              value={agentUrl}
              onInput={(e) => setAgentUrl(e.target.value)}
              style={{ flex: 1 }}
            />
            <BusyIndicator active={discovering} size="S">
              <Button onClick={handleDiscover} disabled={!agentUrl || discovering}>
                Discover
              </Button>
            </BusyIndicator>
          </FlexBox>
        </FlexBox>

        {/* Proxy Toggle */}
        <FlexBox alignItems="Center" style={{ gap: '0.75rem', padding: '0.5rem 0' }}>
          <Switch checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} />
          <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
            <Text style={{ fontWeight: 600, fontSize: '0.875rem' }}>Use Proxy Server</Text>
            <Text style={{ fontSize: '0.75rem', color: 'var(--sapContent_LabelColor)' }}>
              {useProxy
                ? 'Requests will go through localhost:3001 proxy (bypasses CORS)'
                : 'Direct connection to agent (requires CORS configuration)'}
            </Text>
          </FlexBox>
        </FlexBox>

        {discoveryError && (
          <MessageStrip design="Negative" hideCloseButton>
            {discoveryError}
          </MessageStrip>
        )}

        {agentCard && (
          <MessageStrip design="Positive" hideCloseButton>
            <strong>{agentCard.name}</strong>
            {agentCard.description ? ` — ${agentCard.description}` : ''}
            {agentCard.capabilities?.streaming ? ' | Streaming: Yes' : ' | Streaming: No'}
            {agentCard.skills?.length
              ? ` | Skills: ${agentCard.skills.map((s) => s.name).join(', ')}`
              : ''}
          </MessageStrip>
        )}

        {/* OIDC Configuration */}
        <Panel headerText="Authentication (OIDC)" collapsed>
          <FlexBox direction="Column" style={{ gap: '0.75rem', padding: '0.5rem' }}>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Issuer URL</Label>
              <Input
                placeholder="https://auth.example.com"
                value={issuerUrl}
                onInput={(e) => setIssuerUrl(e.target.value)}
                style={{ width: '100%' }}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Client ID</Label>
              <Input
                value={clientId}
                onInput={(e) => setClientId(e.target.value)}
                style={{ width: '100%' }}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Client Secret</Label>
              <Input
                type="Password"
                value={clientSecret}
                onInput={(e) => setClientSecret(e.target.value)}
                style={{ width: '100%' }}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Scopes</Label>
              <Input
                placeholder="openid profile"
                value={scopes}
                onInput={(e) => setScopes(e.target.value)}
                style={{ width: '100%' }}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Token Endpoint (optional, overrides discovery)</Label>
              <Input
                placeholder="https://auth.example.com/oauth/token"
                value={tokenEndpoint}
                onInput={(e) => setTokenEndpoint(e.target.value)}
                style={{ width: '100%' }}
              />
            </FlexBox>
          </FlexBox>
        </Panel>
      </FlexBox>
    </Dialog>
  );
}
