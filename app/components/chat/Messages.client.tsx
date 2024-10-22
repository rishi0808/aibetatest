import type { Message } from 'ai';
import React from 'react';
import { VirtualizedMessages } from './VirtualizedMessages';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
}

// Replace the original Messages component with the virtualized version
export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>((props, ref) => {
  return <VirtualizedMessages {...props} ref={ref} />;
});
