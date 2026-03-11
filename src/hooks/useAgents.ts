import { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAgentStore } from '../store/agentStore.ts';
import { A2AClient } from '../services/a2a/client.ts';
import type { AgentCard } from '../services/a2a/types.ts';
import type { AgentConfig, OidcConfig } from '../types/index.ts';

export function useAgents() {
  const { agents, selectedAgentId, addAgent, removeAgent, selectAgent, getAgent, updateAgent } =
    useAgentStore();

  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const discoverAgent = useCallback(async (baseUrl: string, useProxy = true): Promise<AgentCard | null> => {
    setDiscovering(true);
    setDiscoveryError(null);
    try {
      const card = await A2AClient.discoverAgent(baseUrl, useProxy);
      return card;
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : 'Discovery failed');
      return null;
    } finally {
      setDiscovering(false);
    }
  }, []);

  const saveAgent = useCallback(
    (agentUrl: string, agentCard?: AgentCard, auth?: OidcConfig, useProxy = true, preGeneratedId?: string) => {
      // Check if agent already exists by URL
      const normalizedUrl = agentUrl.toLowerCase().trim();
      const existingAgent = agents.find(
        (a) => a.agentUrl.toLowerCase().trim() === normalizedUrl
      );

      if (existingAgent) {
        setDiscoveryError('This agent is already added');
        return null;
      }

      const config: AgentConfig = {
        id: preGeneratedId || uuidv4(),
        agentUrl,
        agentCard,
        auth,
        useProxy,
        createdAt: Date.now(),
      };
      addAgent(config);
      setDiscoveryError(null);
      return config;
    },
    [addAgent, agents],
  );

  const selectedAgent = selectedAgentId ? getAgent(selectedAgentId) : undefined;

  return {
    agents,
    selectedAgent,
    selectedAgentId,
    selectAgent,
    saveAgent,
    removeAgent,
    updateAgent,
    discoverAgent,
    discovering,
    discoveryError,
  };
}
