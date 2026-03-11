import { useState } from 'react';
import {
  Bar,
  Button,
  FlexBox,
  List,
  ListItemStandard,
  Title,
  Dialog,
  Text,
  Avatar,
  Icon,
} from '@ui5/webcomponents-react';
import '@ui5/webcomponents-icons/dist/chain-link.js';
import { useAgents } from '../../hooks/useAgents.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { useAgentStore } from '../../store/agentStore.ts';
import { useChatStore } from '../../store/chatStore.ts';
import { AddAgentDialog } from '../agents/AddAgentDialog.tsx';
import type { AuthStatus } from '../../types/index.ts';

export function Sidebar() {
  const { agents, selectedAgentId, selectAgent, removeAgent } = useAgents();
  const { authenticate } = useAuth();
  const authStatuses = useAgentStore((s) => s.authStatuses);
  const {
    getConversationsForAgent,
    selectedConversationId,
    selectConversation,
    createConversation,
    deleteConversation,
    deleteAllConversationsForAgent,
  } = useChatStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'agent' | 'conversation';
    id: string;
    name: string;
  }>({ open: false, type: 'conversation', id: '', name: '' });

  const handleDeleteAgent = (agentId: string, agentName: string) => {
    setConfirmDialog({ open: true, type: 'agent', id: agentId, name: agentName });
  };

  const handleDeleteConversation = (conversationId: string, conversationTitle: string) => {
    setConfirmDialog({ open: true, type: 'conversation', id: conversationId, name: conversationTitle });
  };

  const handleConfirmDelete = () => {
    if (confirmDialog.type === 'agent') {
      deleteAllConversationsForAgent(confirmDialog.id);
      removeAgent(confirmDialog.id);
    } else {
      deleteConversation(confirmDialog.id);
    }
    setConfirmDialog({ open: false, type: 'conversation', id: '', name: '' });
  };

  const getAgentInitials = (agentName: string): string => {
    const words = agentName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return agentName.slice(0, 2).toUpperCase();
  };

  const getAuthStatus = (agentId: string, hasAuth: boolean): AuthStatus => {
    if (!hasAuth) return 'none';
    return authStatuses[agentId] || 'none';
  };

  const handleAgentClick = async (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;

    const status = getAuthStatus(agentId, !!agent.auth?.clientId);

    if (status === 'disconnected' && agent.auth) {
      // Auto-trigger re-auth popup
      try {
        await authenticate(agentId, agent.agentUrl, agent.auth);
      } catch (err) {
        console.error('[Sidebar] Re-auth failed:', err);
      }
    } else {
      selectAgent(agentId);
    }
  };

  const selectedAgent = selectedAgentId ? agents.find(a => a.id === selectedAgentId) : null;
  const conversations = selectedAgent ? getConversationsForAgent(selectedAgent.id) : [];

  return (
    <>
      <FlexBox
        style={{
          width: '320px',
          background: 'var(--sapBackgroundColor)',
          overflow: 'hidden',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Agent Strip (Left) */}
        <FlexBox
          direction="Column"
          style={{
            width: '72px',
            background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.3))',
            backdropFilter: 'blur(10px)',
            padding: '1.25rem 0.5rem',
            gap: '1.25rem',
            alignItems: 'center',
            overflow: 'auto',
          }}
        >
          {agents.map((agent) => {
            const agentName = agent.agentCard?.name ?? agent.agentUrl;
            const isSelected = agent.id === selectedAgentId;
            const convCount = getConversationsForAgent(agent.id).length;
            const status = getAuthStatus(agent.id, !!agent.auth?.clientId);
            const isDisconnected = status === 'disconnected';

            return (
              <FlexBox
                key={agent.id}
                direction="Column"
                style={{
                  position: 'relative',
                  alignItems: 'center',
                  cursor: 'pointer',
                  gap: '0.5rem',
                  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onClick={() => handleAgentClick(agent.id)}
                title={
                  isDisconnected
                    ? `${agentName} — Authentication expired, click to reconnect`
                    : agentName
                }
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                }}
              >
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  <Avatar
                    size="M"
                    initials={getAgentInitials(agentName)}
                    colorScheme={`Accent${(agents.indexOf(agent) % 10) + 1}` as any}
                    style={{
                      cursor: 'pointer',
                      boxShadow: isSelected
                        ? '0 4px 12px rgba(10, 110, 209, 0.3), 0 0 0 3px rgba(10, 110, 209, 0.1)'
                        : '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      opacity: isDisconnected ? 0.5 : 1,
                      filter: isDisconnected ? 'grayscale(60%)' : 'none',
                    }}
                  />
                  {isDisconnected && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'var(--sapNegativeColor, #bb0000)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    >
                      <Icon
                        name="chain-link"
                        style={{
                          width: '12px',
                          height: '12px',
                          color: 'white',
                        }}
                      />
                    </div>
                  )}
                </div>
                {convCount > 0 && (
                  <div
                    style={{
                      fontSize: '10px',
                      color: isSelected ? 'var(--sapButton_Emphasized_Background)' : 'var(--sapContent_LabelColor)',
                      fontWeight: 700,
                      transition: 'color 0.2s ease',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {convCount}
                  </div>
                )}
                {isSelected && (
                  <Button
                    icon="delete"
                    design="Transparent"
                    tooltip="Delete Agent"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAgent(agent.id, agentName);
                    }}
                    style={{
                      width: '28px',
                      height: '28px',
                      minWidth: '28px',
                      padding: 0,
                      color: 'var(--sapNegativeColor)',
                      opacity: 0.7,
                      transition: 'opacity 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.7';
                    }}
                  />
                )}
              </FlexBox>
            );
          })}
          <div
            onClick={() => setDialogOpen(true)}
            title="Add Agent"
            style={{
              marginTop: 'auto',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--sapButton_Emphasized_Background)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(10, 110, 209, 0.25)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontSize: '20px',
              fontWeight: 300,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(10, 110, 209, 0.35)';
              e.currentTarget.style.background = 'var(--sapButton_Emphasized_Hover_Background)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(10, 110, 209, 0.25)';
              e.currentTarget.style.background = 'var(--sapButton_Emphasized_Background)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.background = 'var(--sapButton_Emphasized_Active_Background)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.background = 'var(--sapButton_Emphasized_Hover_Background)';
            }}
          >
            +
          </div>
        </FlexBox>

        {/* Conversations Panel (Right) */}
        <FlexBox
          direction="Column"
          style={{ flex: 1, overflow: 'hidden', background: 'var(--sapList_Background)' }}
        >
          <Bar
            startContent={
              <Title level="H5" style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--sapTextColor)',
                letterSpacing: '-0.01em',
              }}>
                {selectedAgent ? selectedAgent.agentCard?.name ?? selectedAgent.agentUrl : 'Conversations'}
              </Title>
            }
            endContent={
              selectedAgent && (
                <Button
                  icon="add"
                  design="Transparent"
                  tooltip="New Conversation"
                  onClick={() => createConversation(selectedAgent.id)}
                  style={{
                    color: 'var(--sapButton_Emphasized_Background)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                />
              )
            }
            style={{
              flexShrink: 0,
              background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.4))',
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          />
          <List
            selectionMode="Single"
            onSelectionChange={(e) => {
              const item = e.detail.selectedItems[0];
              if (item) {
                const conversationId = item.dataset.conversationId;
                if (conversationId) {
                  selectConversation(conversationId);
                }
              }
            }}
            style={{ flex: 1, overflow: 'auto' }}
          >
            {!selectedAgent ? (
              <FlexBox
                direction="Column"
                alignItems="Center"
                justifyContent="Center"
                style={{ padding: '4rem 2rem', gap: '0.75rem' }}
              >
                <div style={{
                  fontSize: '56px',
                  opacity: 0.15,
                  marginBottom: '0.5rem',
                  filter: 'grayscale(100%)',
                }}>💬</div>
                <Text style={{
                  color: 'var(--sapContent_LabelColor)',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                  lineHeight: '1.5',
                  opacity: 0.8,
                }}>
                  Select an agent to view conversations
                </Text>
              </FlexBox>
            ) : conversations.length === 0 ? (
              <FlexBox
                direction="Column"
                alignItems="Center"
                justifyContent="Center"
                style={{ padding: '4rem 2rem', gap: '0.75rem' }}
              >
                <div style={{
                  fontSize: '56px',
                  opacity: 0.15,
                  marginBottom: '0.5rem',
                  filter: 'grayscale(20%)',
                }}>✨</div>
                <Text style={{
                  color: 'var(--sapContent_LabelColor)',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                  lineHeight: '1.5',
                  maxWidth: '200px',
                  opacity: 0.8,
                }}>
                  No conversations yet. Click + to start chatting.
                </Text>
              </FlexBox>
            ) : (
              conversations
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((conv) => {
                  const isSelected = conv.id === selectedConversationId;
                  return (
                    <ListItemStandard
                      key={conv.id}
                      data-conversation-id={conv.id}
                      selected={isSelected}
                      description={new Date(conv.updatedAt).toLocaleString()}
                      style={{
                        borderLeft: 'none',
                        borderRadius: '8px',
                        margin: '0.25rem 0.5rem',
                        background: isSelected ? 'rgba(10, 110, 209, 0.08)' : 'transparent',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: isSelected ? '0 2px 8px rgba(10, 110, 209, 0.12)' : 'none',
                      }}
                    >
                      <FlexBox justifyContent="SpaceBetween" alignItems="Center" style={{ width: '100%', gap: '0.5rem' }}>
                        <span style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.8125rem',
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'var(--sapButton_Emphasized_Background)' : 'inherit',
                          transition: 'color 0.2s ease',
                        }}>
                          {conv.title}
                        </span>
                        {isSelected && (
                          <Button
                            icon="delete"
                            design="Transparent"
                            tooltip="Delete Conversation"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conv.id, conv.title);
                            }}
                            style={{
                              color: 'var(--sapNegativeColor)',
                              minWidth: '2rem',
                              height: '2rem',
                              opacity: 0.6,
                              transition: 'opacity 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '1';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '0.6';
                            }}
                          />
                        )}
                      </FlexBox>
                    </ListItemStandard>
                  );
                })
            )}
          </List>
        </FlexBox>
      </FlexBox>

      <AddAgentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
        headerText={`Delete ${confirmDialog.type === 'agent' ? 'Agent' : 'Conversation'}`}
        footer={
          <Bar
            endContent={
              <FlexBox style={{ gap: '0.5rem' }}>
                <Button
                  design="Transparent"
                  onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
                >
                  Cancel
                </Button>
                <Button design="Negative" onClick={handleConfirmDelete}>
                  Delete
                </Button>
              </FlexBox>
            }
          />
        }
      >
        <FlexBox direction="Column" style={{ padding: '1rem', gap: '0.5rem' }}>
          <Text>
            Are you sure you want to delete{' '}
            {confirmDialog.type === 'agent' ? 'this agent' : 'this conversation'}?
          </Text>
          <Text style={{ fontWeight: 'bold' }}>{confirmDialog.name}</Text>
          {confirmDialog.type === 'agent' && (
            <Text style={{ color: 'var(--sapNegativeTextColor)' }}>
              This will also delete all conversations with this agent.
            </Text>
          )}
        </FlexBox>
      </Dialog>
    </>
  );
}
