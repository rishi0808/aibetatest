import type { Message } from 'ai';
import React, { useEffect, useRef, useState } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';

const VIEWPORT_SIZE = 10; // Number of messages to keep in view
const BUFFER_SIZE = 5; // Number of messages to keep in buffer above/below viewport

interface VirtualizedMessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
}

export const VirtualizedMessages = React.forwardRef<HTMLDivElement, VirtualizedMessagesProps>((props: VirtualizedMessagesProps, forwardedRef) => {
  const { id, isStreaming = false, messages = [] } = props;
  const localRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: VIEWPORT_SIZE });

  // Sync refs
  useEffect(() => {
    if (!localRef.current) return;
    
    if (typeof forwardedRef === 'function') {
      forwardedRef(localRef.current);
    } else if (forwardedRef) {
      forwardedRef.current = localRef.current;
    }
  }, [forwardedRef]);

  // Update visible range based on scroll position
  useEffect(() => {
    const container = localRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = container;
      const messageHeight = scrollHeight / messages.length;
      const visibleMessages = Math.ceil(clientHeight / messageHeight);
      
      let start = Math.floor(scrollTop / messageHeight) - BUFFER_SIZE;
      start = Math.max(0, start);
      
      let end = start + visibleMessages + (BUFFER_SIZE * 2);
      end = Math.min(messages.length, end);

      setVisibleRange({ start, end });
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial calculation

    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  // Calculate total height to maintain scroll position
  const totalHeight = messages.length * 100; // Approximate height per message
  const visibleMessages = messages.slice(visibleRange.start, visibleRange.end);

  return (
    <div 
      id={id} 
      ref={localRef}
      className={props.className}
      style={{ overflowY: 'auto' }}
    >
      <div style={{ height: visibleRange.start * 100 }} /> {/* Top spacer */}
      {visibleMessages.map((message, index) => {
        const { role, content } = message;
        const isUserMessage = role === 'user';
        const absoluteIndex = visibleRange.start + index;
        const isFirst = absoluteIndex === 0;
        const isLast = absoluteIndex === messages.length - 1;

        return (
          <div
            key={absoluteIndex}
            className={classNames('flex gap-4 p-6 w-full rounded-[calc(0.75rem-1px)]', {
              'bg-bolt-elements-messages-background': isUserMessage || !isStreaming || (isStreaming && !isLast),
              'bg-gradient-to-b from-bolt-elements-messages-background from-30% to-transparent':
                isStreaming && isLast,
              'mt-4': !isFirst,
            })}
          >
            {isUserMessage && (
              <div className="flex items-center justify-center w-[34px] h-[34px] overflow-hidden bg-white text-gray-600 rounded-full shrink-0 self-start">
                <div className="i-ph:user-fill text-xl"></div>
              </div>
            )}
            <div className="grid grid-col-1 w-full">
              {isUserMessage ? <UserMessage content={content} /> : <AssistantMessage content={content} />}
            </div>
          </div>
        );
      })}
      <div style={{ height: (messages.length - visibleRange.end) * 100 }} /> {/* Bottom spacer */}
      {isStreaming && (
        <div className="text-center w-full text-bolt-elements-textSecondary i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
      )}
    </div>
  );
});
