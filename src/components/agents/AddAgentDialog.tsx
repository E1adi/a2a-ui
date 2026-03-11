import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
import { useAuth } from '../../hooks/useAuth.ts';
import { useAgentStore } from '../../store/agentStore.ts';
import { A2AClient } from '../../services/a2a/client.ts';
import { A2AHttpError } from '../../utils/errors.ts';
import type { AgentCard } from '../../services/a2a/types.ts';
import type { OidcConfig } from '../../types/index.ts';

interface AddAgentDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddAgentDialog({ open, onClose }: AddAgentDialogProps) {
  const { saveAgent } = useAgents();
  const { authenticate } = useAuth();
  const setAuthStatus = useAgentStore((s) => s.setAuthStatus);

  const [agentUrl, setAgentUrl] = useState('');
  const [agentCard, setAgentCard] = useState<AgentCard | null>(null);
  const [useProxy, setUseProxy] = useState(true);

  // OIDC fields
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scopes, setScopes] = useState('');
  const [audience, setAudience] = useState('');

  // Auth state
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Local discovery state (replaces hook-based discovery)
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Controlled OIDC panel collapsed state
  const [oidcPanelCollapsed, setOidcPanelCollapsed] = useState(true);

  const DEFAULT_SCOPES = 'openid profile';
  const hasOidc = clientId.trim().length > 0;

  const resetForm = useCallback(() => {
    setAgentUrl('');
    setAgentCard(null);
    setUseProxy(true);
    setIssuerUrl('');
    setClientId('');
    setClientSecret('');
    setScopes('');
    setAudience('');
    setAuthenticating(false);
    setAuthError(null);
    setDiscovering(false);
    setDiscoveryError(null);
    setOidcPanelCollapsed(true);
  }, []);

  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscoveryError(null);
    try {
      const card = await A2AClient.discoverAgent(agentUrl.trim(), hasOidc ? true : useProxy);
      setAgentCard(card);
    } catch (err) {
      if (err instanceof A2AHttpError && (err.status === 401 || err.status === 403)) {
        setOidcPanelCollapsed(false);
        setDiscoveryError('Agent requires authentication. Fill in the OIDC fields below, then click Save.');
      } else {
        setDiscoveryError(err instanceof Error ? err.message : 'Discovery failed');
      }
    } finally {
      setDiscovering(false);
    }
  };

  const handleSave = async () => {
    setAuthError(null);
    setDiscoveryError(null);
    const effectiveUseProxy = hasOidc ? true : useProxy;
    const effectiveUrl = agentUrl.trim();

    // Try discovery (unauthenticated)
    let card: AgentCard | null = null;
    let discoveryNeedsAuth = false;

    try {
      card = await A2AClient.discoverAgent(effectiveUrl, effectiveUseProxy);
    } catch (err) {
      if (err instanceof A2AHttpError && (err.status === 401 || err.status === 403)) {
        if (!hasOidc) {
          setOidcPanelCollapsed(false);
          setDiscoveryError('Agent requires authentication. Fill in the OIDC fields below, then click Save.');
          return;
        }
        discoveryNeedsAuth = true;
      } else {
        setDiscoveryError(err instanceof Error ? err.message : 'Discovery failed');
        return;
      }
    }

    if (discoveryNeedsAuth) {
      // Auth-before-discovery fallback: authenticate first, then retry discovery
      const agentId = uuidv4();
      const oidcConfig: OidcConfig = {
        issuerUrl: issuerUrl.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim() || undefined,
        scopes: scopes.trim() || DEFAULT_SCOPES,
        audience: audience.trim() || undefined,
      };

      setAuthenticating(true);
      try {
        await authenticate(agentId, effectiveUrl, oidcConfig);
        // Retry discovery — proxy now has token and will match by URL
        card = await A2AClient.discoverAgent(effectiveUrl, true);
        const result = saveAgent(effectiveUrl, card!, oidcConfig, true, agentId);
        if (result) {
          setAuthStatus(agentId, 'connected');
          resetForm();
          onClose();
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Authentication or discovery failed');
      } finally {
        setAuthenticating(false);
      }
      return;
    }

    // Discovery succeeded
    if (hasOidc) {
      // OIDC flow: generate ID upfront, authenticate via popup, then save
      const agentId = uuidv4();
      const oidcConfig: OidcConfig = {
        issuerUrl: issuerUrl.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim() || undefined,
        scopes: scopes.trim() || DEFAULT_SCOPES,
        audience: audience.trim() || undefined,
      };

      setAuthenticating(true);
      try {
        await authenticate(agentId, effectiveUrl, oidcConfig);

        // Auth succeeded — save agent
        const result = saveAgent(effectiveUrl, card!, oidcConfig, true, agentId);
        if (result) {
          setAuthStatus(agentId, 'connected');
          resetForm();
          onClose();
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Authentication failed');
      } finally {
        setAuthenticating(false);
      }
    } else {
      // No OIDC: save directly
      const result = saveAgent(effectiveUrl, card!, undefined, effectiveUseProxy);
      if (result) {
        resetForm();
        onClose();
      }
    }
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
              <Button design="Transparent" onClick={handleClose} disabled={authenticating}>
                Cancel
              </Button>
              <Button
                design="Emphasized"
                onClick={handleSave}
                disabled={!agentUrl.trim() || discovering || authenticating}
              >
                {authenticating ? 'Authenticating...' : 'Save'}
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
              disabled={authenticating}
            />
            <BusyIndicator active={discovering} size="S">
              <Button onClick={handleDiscover} disabled={!agentUrl || discovering || authenticating}>
                Discover
              </Button>
            </BusyIndicator>
          </FlexBox>
        </FlexBox>

        {/* Proxy Toggle */}
        <FlexBox alignItems="Center" style={{ gap: '0.75rem', padding: '0.5rem 0' }}>
          <Switch
            checked={hasOidc ? true : useProxy}
            onChange={(e) => setUseProxy(e.target.checked)}
            disabled={hasOidc || authenticating}
          />
          <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
            <Text style={{ fontWeight: 600, fontSize: '0.875rem' }}>Use Proxy Server</Text>
            <Text style={{ fontSize: '0.75rem', color: 'var(--sapContent_LabelColor)' }}>
              {hasOidc
                ? 'Proxy is required for authenticated agents'
                : useProxy
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

        {authError && (
          <MessageStrip design="Negative" hideCloseButton>
            {authError}
          </MessageStrip>
        )}

        {authenticating && (
          <MessageStrip design="Information" hideCloseButton>
            <BusyIndicator active size="S" style={{ marginRight: '0.5rem' }} />
            Waiting for authentication in popup window...
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
        <Panel
          headerText="Authentication (OIDC)"
          collapsed={oidcPanelCollapsed}
          onToggle={() => setOidcPanelCollapsed((c) => !c)}
        >
          <FlexBox direction="Column" style={{ gap: '0.75rem', padding: '0.5rem' }}>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Issuer URL</Label>
              <Input
                placeholder="https://auth.example.com"
                value={issuerUrl}
                onInput={(e) => setIssuerUrl(e.target.value)}
                style={{ width: '100%' }}
                disabled={authenticating}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Client ID</Label>
              <Input
                value={clientId}
                onInput={(e) => setClientId(e.target.value)}
                style={{ width: '100%' }}
                disabled={authenticating}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Client Secret (optional)</Label>
              <Input
                type="Password"
                value={clientSecret}
                onInput={(e) => setClientSecret(e.target.value)}
                style={{ width: '100%' }}
                disabled={authenticating}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Scopes</Label>
              <Input
                placeholder="openid profile"
                value={scopes}
                onInput={(e) => setScopes(e.target.value)}
                style={{ width: '100%' }}
                disabled={authenticating}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Audience / Resource (optional)</Label>
              <Input
                placeholder="api://my-resource"
                value={audience}
                onInput={(e) => setAudience(e.target.value)}
                style={{ width: '100%' }}
                disabled={authenticating}
              />
            </FlexBox>
          </FlexBox>
        </Panel>
      </FlexBox>
    </Dialog>
  );
}
