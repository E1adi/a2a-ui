import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { A2AClient } from '../services/a2a/client.ts';
import { sendStreamingMessage } from '../services/a2a/streaming.ts';
import { useChatStore } from '../store/chatStore.ts';
import { useAuth } from './useAuth.ts';
import type { AgentConfig, ChatMessage } from '../types/index.ts';
import type { Message, Part, StreamResponse, Task } from '../services/a2a/types.ts';

export function useA2AClient() {
  const { getToken } = useAuth();
  const {
    getSelectedConversation,
    createConversation,
    addMessage,
    updateMessage,
    appendStreamingContent,
    addTask,
    setContextId,
    addArtifact,
    setCurrentStatus,
    clearCurrentStatus,
    setActiveStream,
    clearActiveStream,
    cancelStream,
    activeStreams,
  } = useChatStore();

  const sendMessage = useCallback(
    async (agent: AgentConfig, text: string) => {
      let conversation = getSelectedConversation();

      // Create conversation if none selected or if selected conversation doesn't belong to this agent
      if (!conversation || conversation.agentId !== agent.id) {
        conversation = createConversation(agent.id);
      }

      const conversationId = conversation.id;

      // Create user message
      const userMessage: ChatMessage = {
        messageId: uuidv4(),
        role: 'user',
        parts: [{ kind: 'text', text }],
        contextId: conversation.contextId,
        status: 'sent',
        timestamp: Date.now(),
      };
      addMessage(conversationId, userMessage);

      // Build A2A message
      const a2aMessage: Message = {
        messageId: userMessage.messageId,
        role: 'user',
        parts: userMessage.parts,
        contextId: conversation.contextId,
      };

      const supportsStreaming = agent.agentCard?.capabilities?.streaming ?? false;
      const agentUrl = agent.agentCard?.url ?? agent.agentUrl;
      const useProxy = agent.useProxy ?? true;

      // Set initial status (will be shown as indicator, not a bubble)
      setCurrentStatus(conversationId, 'Connecting...');

      try {
        const token = await getToken(agent.id, agent.auth);

        if (supportsStreaming) {
          // Agent message will be created when artifact arrives
          const agentMsgId = uuidv4();

          const controller = sendStreamingMessage(
            agentUrl,
            a2aMessage,
            undefined,
            token,
            (event: StreamResponse) => {
              // On first stream event, change status to streaming
              const msg = useChatStore.getState().getConversation(conversationId)
                ?.messages.find((m) => m.messageId === agentMsgId);
              if (msg?.status === 'processing') {
                updateMessage(conversationId, agentMsgId, {
                  status: 'streaming',
                  streamingContent: '',
                });
              }
              handleStreamEvent(conversationId, agentMsgId, event);
            },
            (error: Error) => {
              updateMessage(conversationId, agentMsgId, {
                status: 'error',
                error: error.message,
              });
              clearActiveStream(conversationId);
            },
            () => {
              console.log('[useA2AClient] Stream complete');
              clearCurrentStatus(conversationId);
              clearActiveStream(conversationId);
            },
            useProxy,
          );

          setActiveStream(conversationId, controller);
        } else {
          // Non-streaming: synchronous request/response
          const client = new A2AClient(agentUrl, async () => token, useProxy);
          const task: Task = await client.sendMessage(a2aMessage);

          if (task.contextId) {
            setContextId(conversationId, task.contextId);
          }
          addTask(conversationId, task);

          // Extract agent response from task
          const agentParts: Part[] = [];
          if (task.status.message) {
            agentParts.push(...task.status.message.parts);
          }
          if (task.artifacts) {
            for (const artifact of task.artifacts) {
              addArtifact(conversationId, artifact);
            }
          }

          // Determine response parts - check multiple sources
          let responseParts: Part[] = [];
          if (agentParts.length > 0) {
            responseParts = agentParts;
          } else if (task.history?.length) {
            responseParts = task.history.filter((m) => m.role === 'agent').flatMap((m) => m.parts);
          }

          // Update the processing message with actual response
          updateMessage(conversationId, agentMsgId, {
            parts: responseParts,
            contextId: task.contextId,
            taskId: task.id,
            status: responseParts.length > 0 ? 'sent' : 'error',
            error: responseParts.length === 0 ? 'Agent returned no response' : undefined,
          });

          console.log('[useA2AClient] Non-streaming response:', {
            taskStatus: task.status,
            agentParts: agentParts.length,
            historyLength: task.history?.length,
            responseParts: responseParts.length,
            taskState: task.status.state,
            fullTask: task,
          });
        }
      } catch (err) {
        const errorMessage: ChatMessage = {
          messageId: uuidv4(),
          role: 'agent',
          parts: [{ kind: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          status: 'error',
          timestamp: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        };
        addMessage(conversationId, errorMessage);
      }
    },
    [getToken, getSelectedConversation, createConversation, addMessage, updateMessage, appendStreamingContent, addTask, setContextId, addArtifact, setActiveStream, clearActiveStream],
  );

  const handleStreamEvent = useCallback(
    (conversationId: string, agentMsgId: string, event: StreamResponse) => {
      console.log('[useA2AClient] Stream event received:', event);

      // Handle discriminated union format (kind property)
      if ('kind' in event) {
        if (event.kind === 'status-update') {
          const { taskId, contextId, status, final } = event;
          if (contextId) setContextId(conversationId, contextId);

          console.log('[useA2AClient] Status update:', {
            taskId,
            contextId,
            statusMessage: status.message,
            statusMessageParts: status.message?.parts,
            statusState: status.state,
            final,
          });

          // Update status indicator (don't create message bubble)
          if (status.message) {
            const textParts = status.message.parts.filter((p) => p.kind === 'text');
            const statusText = textParts.map((p) => p.kind === 'text' ? p.text : '').join(' ');
            if (statusText) {
              console.log('[useA2AClient] Setting status:', statusText);
              setCurrentStatus(conversationId, statusText);
            }
          }

          if (final) {
            clearCurrentStatus(conversationId);
            clearActiveStream(conversationId);
          }

          // Update task state if we have a task
          if (taskId) {
            addTask(conversationId, {
              id: taskId,
              contextId: contextId ?? '',
              status,
            });
          }
        } else if (event.kind === 'artifact-update') {
          console.log('[useA2AClient] Artifact update:', event.artifact);
          addArtifact(conversationId, event.artifact);

          // Clear status and create message bubble for artifact content
          const artifact = event.artifact;
          if (artifact.name === 'agent_result' && artifact.parts) {
            clearCurrentStatus(conversationId);

            const textParts = artifact.parts.filter(p => p.kind === 'text');
            const parts: Part[] = [];
            for (const part of textParts) {
              if (part.kind === 'text') {
                console.log('[useA2AClient] Creating message from artifact:', part.text);
                parts.push(part);
              }
            }

            // Create the agent message bubble with artifact content
            if (parts.length > 0) {
              const agentMessage: ChatMessage = {
                messageId: agentMsgId,
                role: 'agent',
                parts,
                contextId: event.contextId,
                status: 'sent',
                timestamp: Date.now(),
              };
              addMessage(conversationId, agentMessage);
            }
          }
        } else if (event.kind === 'task') {
          const { id, contextId, status, history } = event;
          console.log('[useA2AClient] Task event:', {
            id,
            contextId,
            status,
            history,
            statusMessage: status.message,
            historyMessages: history?.map(m => ({ role: m.role, parts: m.parts })),
          });

          if (contextId) setContextId(conversationId, contextId);
          addTask(conversationId, {
            id,
            contextId: contextId ?? '',
            status,
            history,
          });

          // Extract agent response from task history or status
          if (history && history.length > 0) {
            const agentMessages = history.filter(m => m.role === 'agent');
            for (const agentMsg of agentMessages) {
              const textParts = agentMsg.parts.filter(p => p.kind === 'text');
              for (const part of textParts) {
                if (part.kind === 'text') {
                  console.log('[useA2AClient] Appending text from task history:', part.text);
                  appendStreamingContent(conversationId, agentMsgId, part.text);
                }
              }
            }
          }

          // Also check status.message
          if (status.message) {
            const textParts = status.message.parts.filter(p => p.kind === 'text');
            for (const part of textParts) {
              if (part.kind === 'text') {
                console.log('[useA2AClient] Appending text from task status:', part.text);
                appendStreamingContent(conversationId, agentMsgId, part.text);
              }
            }
          }
        } else if (event.kind === 'message') {
          const msg = event.message;
          if (msg.role === 'agent') {
            const textParts = msg.parts.filter((p) => p.kind === 'text');
            for (const part of textParts) {
              if (part.kind === 'text') {
                appendStreamingContent(conversationId, agentMsgId, part.text);
              }
            }
          }
        }
      }
      // Legacy format support (wrapped in objects)
      else if ('statusUpdate' in event) {
        const { taskId, contextId, status } = event.statusUpdate;
        if (contextId) setContextId(conversationId, contextId);

        if (status.message) {
          const textParts = status.message.parts.filter((p) => p.kind === 'text');
          for (const part of textParts) {
            if (part.kind === 'text') {
              appendStreamingContent(conversationId, agentMsgId, part.text);
            }
          }
        }

        if (event.statusUpdate.final) {
          const msg = useChatStore.getState().getConversation(conversationId)
            ?.messages.find((m) => m.messageId === agentMsgId);
          if (msg) {
            const finalParts: Part[] = msg.streamingContent
              ? [{ kind: 'text', text: msg.streamingContent }]
              : msg.parts;
            updateMessage(conversationId, agentMsgId, {
              status: 'sent',
              parts: finalParts,
              streamingContent: undefined,
            });
          }
          clearActiveStream(conversationId);
        }

        if (taskId) {
          addTask(conversationId, {
            id: taskId,
            contextId: contextId ?? '',
            status,
          });
        }
      } else if ('artifactUpdate' in event) {
        addArtifact(conversationId, event.artifactUpdate.artifact);
      } else if ('task' in event) {
        const task = event.task;
        if (task.contextId) setContextId(conversationId, task.contextId);
        addTask(conversationId, task);
      } else if ('message' in event) {
        const msg = event.message;
        if (msg.role === 'agent') {
          const textParts = msg.parts.filter((p) => p.kind === 'text');
          for (const part of textParts) {
            if (part.kind === 'text') {
              appendStreamingContent(conversationId, agentMsgId, part.text);
            }
          }
        }
      }
    },
    [setContextId, appendStreamingContent, updateMessage, clearActiveStream, addTask, addArtifact],
  );

  const isStreaming = useCallback(
    (conversationId: string) => !!activeStreams[conversationId],
    [activeStreams],
  );

  return { sendMessage, cancelStream, isStreaming };
}
