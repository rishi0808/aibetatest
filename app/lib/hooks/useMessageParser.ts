import type { Message } from 'ai';
import { useCallback, useRef, useState } from 'react';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useMessageParser');

const messageParser = new StreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      logger.trace('onArtifactOpen', data);

      workbenchStore.showWorkbench.set(true);
      workbenchStore.addArtifact(data);
    },
    onArtifactClose: (data) => {
      logger.trace('onArtifactClose');

      workbenchStore.updateArtifact(data, { closed: true });
    },
    onActionOpen: (data) => {
      logger.trace('onActionOpen', data.action);

      // we only add shell actions when when the close tag got parsed because only then we have the content
      if (data.action.type !== 'shell') {
        workbenchStore.addAction(data);
      }
    },
    onActionClose: (data) => {
      logger.trace('onActionClose', data.action);

      if (data.action.type === 'shell') {
        workbenchStore.addAction(data);
      }

      workbenchStore.runAction(data);
    },
  },
});

export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});
  const processedMessageIds = useRef<Set<string>>(new Set());
  const streamingContent = useRef<{ [key: string]: string }>({});

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant') {
        if (isLoading) {
          // For streaming messages, concatenate new content
          const newParsedContent = messageParser.parse(message.id, message.content);
          streamingContent.current[message.id] = (streamingContent.current[message.id] || '') + newParsedContent;
          
          setParsedMessages((prevParsed) => ({
            ...prevParsed,
            [index]: streamingContent.current[message.id],
          }));
        } else if (!processedMessageIds.current.has(message.id)) {
          // For completed messages that haven't been processed
          const newParsedContent = messageParser.parse(message.id, message.content);
          processedMessageIds.current.add(message.id);
          
          // Store the complete parsed content
          streamingContent.current[message.id] = newParsedContent;
          
          setParsedMessages((prevParsed) => ({
            ...prevParsed,
            [index]: newParsedContent,
          }));
        } else {
          // For already processed messages, use the stored content
          setParsedMessages((prevParsed) => ({
            ...prevParsed,
            [index]: streamingContent.current[message.id] || '',
          }));
        }
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
