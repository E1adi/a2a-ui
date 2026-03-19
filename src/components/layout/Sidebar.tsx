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
import '@ui5/webcomponents-icons/dist/discussion.js';
import '@ui5/webcomponents-icons/dist/add.js';
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
      try {
        await authenticate(agentId, agent.agentUrl, agent.auth);
        selectAgent(agentId);
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
          borderRight: 'none',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.04)',
          zIndex: 1,
        }}
      >
        {/* Agent Strip (Left) */}
        <FlexBox
          direction="Column"
          style={{
            width: '72px',
            background: 'var(--sapShellColor)',
            borderRight: '1px solid color-mix(in srgb, var(--sapField_BorderColor) 15%, transparent)',
            padding: '1rem 0.5rem',
            gap: '1rem',
            alignItems: 'center',
            overflow: 'auto',
          }}
        >
          {agents.map((agent) => {
            const agentName = agent.displayName || agent.agentCard?.name || agent.agentUrl;
            const isSelected = agent.id === selectedAgentId;
            const status = getAuthStatus(agent.id, !!agent.auth?.clientId);
            const isDisconnected = status === 'disconnected';

            return (
              <FlexBox
                key={agent.id}
                direction="Column"
                className="agent-avatar-item"
                style={{
                  position: 'relative',
                  alignItems: 'center',
                  cursor: 'pointer',
                  gap: '0.375rem',
                  transition: 'transform 0.2s ease',
                }}
                onClick={() => handleAgentClick(agent.id)}
                title={
                  isDisconnected
                    ? `${agentName} — Authentication expired, click to reconnect`
                    : agentName
                }
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  <Avatar
                    size="M"
                    initials={getAgentInitials(agentName)}
                    colorScheme={`Accent${(agents.indexOf(agent) % 10) + 1}` as any}
                    style={{
                      cursor: 'pointer',
                      outline: isSelected
                        ? '2.5px solid var(--sapSelectedColor)'
                        : '2.5px solid transparent',
                      outlineOffset: '2px',
                      transition: 'all 0.2s ease',
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
                        background: 'var(--sapNegativeColor)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--sapShellColor)',
                      }}
                    >
                      <Icon
                        name="chain-link"
                        style={{
                          width: '10px',
                          height: '10px',
                          color: 'var(--sapContent_ContrastTextColor)',
                        }}
                      />
                    </div>
                  )}
                  {!isDisconnected && (
                    <div
                      className="agent-delete-badge"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAgent(agent.id, agentName);
                      }}
                      title="Delete Agent"
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: 'var(--sapNegativeColor)',
                        color: 'var(--sapContent_ContrastTextColor)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 700,
                        lineHeight: 1,
                        border: '2px solid var(--sapShellColor)',
                        cursor: 'pointer',
                        opacity: 0,
                        transform: 'scale(0.5)',
                        pointerEvents: 'none',
                      }}
                    >
                      ×
                    </div>
                  )}
                </div>
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
              color: 'var(--sapContent_ContrastTextColor)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '20px',
              fontWeight: 300,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.background = 'var(--sapButton_Emphasized_Hover_Background)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
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
                fontSize: 'var(--sapFontSize)',
                color: 'var(--sapTitleColor)',
              }}>
                {selectedAgent ? selectedAgent.displayName || selectedAgent.agentCard?.name || selectedAgent.agentUrl : 'Conversations'}
              </Title>
            }
            endContent={
              selectedAgent && (
                <Button
                  icon="add"
                  design="Transparent"
                  tooltip="New Conversation"
                  onClick={() => createConversation(selectedAgent.id)}
                />
              )
            }
            style={{
              flexShrink: 0,
              borderBottom: 'none',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
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
                <Icon
                  name="discussion"
                  style={{
                    width: '48px',
                    height: '48px',
                    color: 'var(--sapContent_NonInteractiveIconColor, var(--sapContent_IconColor))',
                    opacity: 0.3,
                  }}
                />
                <Text style={{
                  color: 'var(--sapContent_LabelColor)',
                  textAlign: 'center',
                  fontSize: 'var(--sapFontSmallSize)',
                  lineHeight: '1.5',
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
                <Icon
                  name="add"
                  style={{
                    width: '48px',
                    height: '48px',
                    color: 'var(--sapContent_NonInteractiveIconColor, var(--sapContent_IconColor))',
                    opacity: 0.3,
                  }}
                />
                <Text style={{
                  color: 'var(--sapContent_LabelColor)',
                  textAlign: 'center',
                  fontSize: 'var(--sapFontSmallSize)',
                  lineHeight: '1.5',
                  maxWidth: '200px',
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
                        borderRadius: 'var(--sapElement_BorderCornerRadius)',
                        margin: '0.25rem 0.5rem',
                      }}
                    >
                      <FlexBox justifyContent="SpaceBetween" alignItems="Center" style={{ width: '100%', gap: '0.5rem' }}>
                        <span style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 'var(--sapFontSize)',
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
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
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
          <Text style={{ fontFamily: 'var(--sapFontSemiboldFamily)' }}>{confirmDialog.name}</Text>
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
