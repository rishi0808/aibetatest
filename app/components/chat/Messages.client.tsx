import type { Message } from 'ai';
import React, { useEffect, useRef } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
}

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>((props: MessagesProps, ref) => {
  const { id, isStreaming = false, messages = [] } = props;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  return (
    <div id={id} ref={ref} className={classNames(props.className, 'relative')}>
      {messages.length > 0
        ? messages.map((message, index) => {
            const { role, content } = message;
            const isUserMessage = role === 'user';
            const isFirst = index === 0;
            const isLast = index === messages.length - 1;
            const hasContent = Boolean(content);

            return (
              <div
                key={index}
                className={classNames(
                  'flex gap-4 p-6 w-full rounded-[calc(0.75rem-1px)] transition-all duration-300',
                  {
                    'opacity-0 translate-y-2': isFirst && isStreaming && !hasContent,
                    'opacity-100 translate-y-0': !isFirst || !isStreaming || hasContent,
                    'bg-bolt-elements-messages-background': isUserMessage || !isStreaming || (isStreaming && !isLast),
                    'bg-gradient-to-b from-bolt-elements-messages-background from-30% to-transparent':
                      isStreaming && isLast,
                    'mt-4': !isFirst,
                  }
                )}
              >
                {isUserMessage && (
                  <div className="flex items-center justify-center w-[34px] h-[34px] overflow-hidden bg-white text-gray-600 rounded-full shrink-0 self-start">
                    <div className="i-ph:user-fill text-xl"></div>
                  </div>
                )}
                <div className="grid grid-col-1 w-full">
                  {isUserMessage ? (
                    <UserMessage content={content} />
                  ) : (
                    <div className="relative">
                      <AssistantMessage content={content} />
                      {isLast && isStreaming && (
                        <div className="absolute -bottom-6 left-0 w-full flex justify-center">
                          <div className="i-svg-spinners:3-dots-fade text-bolt-elements-textSecondary text-2xl"></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        : null}
      {isStreaming && messages.length === 0 && (
        <div className="flex justify-center items-center min-h-[100px]">
          <div className="text-center">
            <div className="i-svg-spinners:3-dots-fade text-bolt-elements-textSecondary text-4xl mb-2"></div>
            <div className="text-bolt-elements-textSecondary text-sm">Processing your message...</div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
});
