import type { Message } from 'ai';
import { useCallback, useEffect, useRef } from 'react';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useMessageParser');

// Cache for parsed messages to prevent re-parsing
const parsedMessageCache = new Map<string, string>();

// LRU cache to limit memory usage
class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    
    // Refresh item position
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove oldest item
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Create a parser instance for each hook instance
function createMessageParser() {
  return new StreamingMessageParser({
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
}

export function useMessageParser() {
  const parserRef = useRef<StreamingMessageParser>();
  const cacheRef = useRef<LRUCache<number, string>>(new LRUCache(50)); // Cache last 50 parsed messages

  // Initialize parser on mount
  useEffect(() => {
    parserRef.current = createMessageParser();
    return () => {
      // Cleanup on unmount
      cacheRef.current.clear();
      if (parserRef.current) {
        parserRef.current.reset();
      }
    };
  }, []);

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    if (!parserRef.current) return {};

    let reset = false;
    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      parserRef.current.reset();
    }

    const parsedMessages: { [key: number]: string } = {};

    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant') {
        // Check cache first
        const cachedContent = !reset && cacheRef.current.get(index);
        if (cachedContent !== undefined) {
          parsedMessages[index] = cachedContent;
          continue;
        }

        // Parse new content
        const messageId = message.id || String(index);
        const cacheKey = `${messageId}-${message.content}`;
        let parsedContent = parsedMessageCache.get(cacheKey);

        if (!parsedContent) {
          parsedContent = parserRef.current.parse(messageId, message.content) || '';
          if (parsedContent) {
            parsedMessageCache.set(cacheKey, parsedContent);
          }
        }

        // Update LRU cache
        cacheRef.current.set(index, parsedContent);
        parsedMessages[index] = parsedContent;
      }
    }

    return parsedMessages;
  }, []);

  return { 
    parsedMessages: useCallback((index: number) => cacheRef.current.get(index) || '', []),
    parseMessages 
  };
}
