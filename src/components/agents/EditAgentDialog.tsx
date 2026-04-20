import { useState, useCallback, useEffect } from 'react';
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
import { A2AClient } from '../../services/a2a/client.ts';
import type { AgentConfig, OidcConfig } from '../../types/index.ts';

interface EditAgentDialogProps {
  open: boolean;
  onClose: () => void;
  agent: AgentConfig;
}

export function EditAgentDialog({ open, onClose, agent }: EditAgentDialogProps) {
  const { updateAgent } = useAgents();

  const [displayName, setDisplayName] = useState('');
  const [useProxy, setUseProxy] = useState(true);

  // OIDC fields
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scopes, setScopes] = useState('');
  const [audience, setAudience] = useState('');

  // State
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oidcPanelCollapsed, setOidcPanelCollapsed] = useState(true);

  const DEFAULT_SCOPES = 'openid profile';
  const hasOidc = clientId.trim().length > 0;

  // Populate form fields when agent changes or dialog opens
  const populateForm = useCallback(() => {
    setDisplayName(agent.displayName || '');
    setUseProxy(agent.useProxy ?? true);
    setIssuerUrl(agent.auth?.issuerUrl || '');
    setClientId(agent.auth?.clientId || '');
    setClientSecret(agent.auth?.clientSecret || '');
    setScopes(agent.auth?.scopes || '');
    setAudience(agent.auth?.audience || '');
    setOidcPanelCollapsed(!agent.auth?.clientId);
    setError(null);
    setSaving(false);
  }, [agent]);

  useEffect(() => {
    if (open) populateForm();
  }, [open, populateForm]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const effectiveUseProxy = hasOidc ? true : useProxy;

    // Re-run discovery to validate agent is reachable
    try {
      await A2AClient.discoverAgent(agent.agentUrl, effectiveUseProxy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent is not reachable. Changes not saved.');
      setSaving(false);
      return;
    }

    // Build updates
    const updates: Partial<AgentConfig> = {
      displayName: displayName.trim() || undefined,
      useProxy: effectiveUseProxy,
    };

    if (hasOidc) {
      const oidcConfig: OidcConfig = {
        issuerUrl: issuerUrl.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim() || undefined,
        scopes: scopes.trim() || DEFAULT_SCOPES,
        audience: audience.trim() || undefined,
      };
      updates.auth = oidcConfig;
    } else {
      updates.auth = undefined;
    }

    updateAgent(agent.id, updates);
    setSaving(false);
    onClose();
  };

  const handleClose = () => {
    populateForm();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      headerText="Edit Agent"
      footer={
        <Bar
          endContent={
            <FlexBox style={{ gap: '0.5rem' }}>
              <Button design="Transparent" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button design="Emphasized" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </FlexBox>
          }
        />
      }
      style={{ width: 'min(560px, 90vw)' }}
    >
      <FlexBox direction="Column" style={{ gap: '1rem', padding: '1rem' }}>
        {/* Agent URL (read-only) */}
        <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
          <Label>Agent Base URL</Label>
          <Input
            value={agent.agentUrl}
            readonly
            style={{ width: '100%' }}
          />
          <Text style={{ fontSize: '0.75rem', color: 'var(--sapContent_LabelColor)' }}>
            URL cannot be changed after creation.
          </Text>
        </FlexBox>

        {/* Display Name */}
        <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
          <Label>Display Name (optional)</Label>
          <Input
            placeholder="e.g. My Weather Agent"
            value={displayName}
            onInput={(e) => setDisplayName(e.target.value)}
            style={{ width: '100%' }}
            disabled={saving}
          />
        </FlexBox>

        {/* Proxy Toggle */}
        <FlexBox alignItems="Center" style={{ gap: '0.75rem', padding: '0.5rem 0' }}>
          <Switch
            checked={hasOidc ? true : useProxy}
            onChange={(e) => setUseProxy(e.target.checked)}
            disabled={hasOidc || saving}
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

        {error && (
          <MessageStrip design="Negative" hideCloseButton>
            {error}
          </MessageStrip>
        )}

        {saving && (
          <MessageStrip design="Information" hideCloseButton>
            <BusyIndicator active size="S" style={{ marginRight: '0.5rem' }} />
            Validating agent...
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
                disabled={saving}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Client ID</Label>
              <Input
                value={clientId}
                onInput={(e) => setClientId(e.target.value)}
                style={{ width: '100%' }}
                disabled={saving}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Client Secret (optional)</Label>
              <Input
                type="Password"
                value={clientSecret}
                onInput={(e) => setClientSecret(e.target.value)}
                style={{ width: '100%' }}
                disabled={saving}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Scopes</Label>
              <Input
                placeholder="openid profile"
                value={scopes}
                onInput={(e) => setScopes(e.target.value)}
                style={{ width: '100%' }}
                disabled={saving}
              />
            </FlexBox>
            <FlexBox direction="Column" style={{ gap: '0.25rem' }}>
              <Label>Audience / Resource (optional)</Label>
              <Input
                placeholder="api://my-resource"
                value={audience}
                onInput={(e) => setAudience(e.target.value)}
                style={{ width: '100%' }}
                disabled={saving}
              />
            </FlexBox>
          </FlexBox>
        </Panel>
      </FlexBox>
    </Dialog>
  );
}
