import { useLoaderData, useNavigate } from '@remix-run/react';
import { useState, useEffect, useCallback } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { getMessages, getNextId, getUrlId, openDatabase, setMessages } from './db';
import { chatStore } from '../stores/chat';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

export const db = persistenceEnabled ? await openDatabase() : undefined;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();
  const [currentChatId, setCurrentChatId] = useState<string | undefined>();

  // Initialize chat ID once at the start
  useEffect(() => {
    if (!currentChatId && !mixedId) {
      const initializeChat = async () => {
        if (db) {
          try {
            const nextId = await getNextId(db);
            setCurrentChatId(nextId);
            chatId.set(nextId);
          } catch (error) {
            console.error('Failed to initialize chat ID:', error);
          }
        }
      };
      initializeChat();
    }
  }, [currentChatId, mixedId]);

  useEffect(() => {
    // Reset chat state when component mounts
    chatStore.setKey('started', false);
    chatStore.setKey('aborted', false);
    
    if (!db) {
      setReady(true);
      if (persistenceEnabled) {
        toast.error('Chat persistence is unavailable');
      }
      return;
    }

    if (mixedId) {
      getMessages(db, mixedId)
        .then((storedMessages) => {
          if (storedMessages && storedMessages.messages.length > 0) {
            setInitialMessages(storedMessages.messages);
            setUrlId(storedMessages.urlId);
            setCurrentChatId(storedMessages.id);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
          } else {
            // Instead of navigating, just reset the state
            setInitialMessages([]);
            setCurrentChatId(undefined);
          }
          setReady(true);
        })
        .catch((error) => {
          console.error('Failed to load messages:', error);
          toast.error('Failed to load chat history');
          setReady(true);
        });
    } else {
      setReady(true);
    }

    return () => {
      chatId.set(undefined);
      description.set(undefined);
      chatStore.setKey('started', false);
      chatStore.setKey('aborted', false);
    };
  }, [mixedId]);

  const storeMessageHistory = useCallback(async (messages: Message[]) => {
    if (!db || messages.length === 0) {
      return;
    }

    try {
      // Ensure we have a chat ID
      let cId = currentChatId;
      if (!cId) {
        cId = await getNextId(db);
        setCurrentChatId(cId);
        chatId.set(cId);
      }

      const { firstArtifact } = workbenchStore;
      let uId = urlId;

      // Only update URL ID if we have an artifact and no existing URL ID
      if (!uId && firstArtifact?.id) {
        uId = await getUrlId(db, firstArtifact.id);
        setUrlId(uId);
        
        // Update URL without page refresh
        const newUrl = `/chat/${uId}`;
        window.history.replaceState(null, '', newUrl);
      }

      // Update description if available
      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      // Store messages with current IDs
      await setMessages(db, cId, messages, uId, description.get());
    } catch (error) {
      console.error('Failed to store messages:', error);
      toast.error('Failed to save chat history');
    }
  }, [currentChatId, urlId, db]);

  return {
    ready: !mixedId || ready,
    initialMessages,
    storeMessageHistory
  };
}
