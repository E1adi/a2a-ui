import { FlexBox, IllustratedMessage } from '@ui5/webcomponents-react';
import '@ui5/webcomponents-fiori/dist/illustrations/NoData.js';
import { useAgents } from '../../hooks/useAgents.ts';
import { useA2AClient } from '../../hooks/useA2AClient.ts';
import { useChatStore } from '../../store/chatStore.ts';
import { AgentCardHeader } from '../agents/AgentCardHeader.tsx';
import { MessageList } from './MessageList.tsx';
import { MessageInput } from './MessageInput.tsx';

export function ChatView() {
  const { selectedAgent } = useAgents();
  const { sendMessage, cancelStream, isStreaming } = useA2AClient();
  const getSelectedConversation = useChatStore((s) => s.getSelectedConversation);

  if (!selectedAgent) {
    return (
      <FlexBox
        justifyContent="Center"
        alignItems="Center"
        style={{ flex: 1 }}
      >
        <IllustratedMessage name="NoData" titleText="No Agent Selected" subtitleText="Add an agent from the sidebar to get started" />
      </FlexBox>
    );
  }

  const conversation = getSelectedConversation();
  const streaming = conversation ? isStreaming(conversation.id) : false;
  const currentStatus = conversation?.currentStatus;

  const handleSend = (text: string) => {
    sendMessage(selectedAgent, text);
  };

  const handleCancel = () => {
    if (conversation) {
      cancelStream(conversation.id);
    }
  };

  return (
    <FlexBox direction="Column" style={{ flex: 1, overflow: 'hidden' }}>
      <AgentCardHeader agent={selectedAgent} />
      <MessageList
        messages={conversation?.messages ?? []}
        artifacts={conversation?.artifacts ?? []}
        agent={selectedAgent}
        currentStatus={currentStatus}
      />
      <MessageInput onSend={handleSend} streaming={streaming} onCancel={handleCancel} />
    </FlexBox>
  );
}
