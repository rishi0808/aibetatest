import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useEffect, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory } = useChatHistory();

  return (
    <>
      {ready && <ChatImpl initialMessages={initialMessages} storeMessageHistory={storeMessageHistory} />}
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
      />
    </>
  );
}

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
}

export const ChatImpl = memo(({ initialMessages, storeMessageHistory }: ChatProps) => {
  useShortcuts();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const animationCompleteRef = useRef(false);
  const messageProcessingRef = useRef(false);
  const initialMessagesProcessedRef = useRef(false);
  const errorRecoveryRef = useRef(false);

  const [chatStarted, setChatStarted] = useState(false);
  const { showChat } = useStore(chatStore);
  const [animationScope, animate] = useAnimate();

  const {
    messages,
    isLoading,
    input,
    handleInputChange,
    setInput,
    stop,
    append,
    reload,
    setMessages
  } = useChat({
    api: '/api/chat',
    onError: (error) => {
      logger.error('Request failed\n\n', error);
      toast.error('There was an error processing your request');
      messageProcessingRef.current = false;
      errorRecoveryRef.current = true;
      
      // Reset processing state after a short delay
      setTimeout(() => {
        errorRecoveryRef.current = false;
      }, 1000);
    },
    onFinish: () => {
      logger.debug('Finished streaming');
      messageProcessingRef.current = false;
    },
    initialMessages,
  });

  const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
  const { parsedMessages, parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  // Initialize chat state based on initialMessages
  useEffect(() => {
    const hasMessages = initialMessages.length > 0;
    
    if (!initialMessagesProcessedRef.current) {
      chatStore.setKey('started', hasMessages);
      setChatStarted(hasMessages);
      animationCompleteRef.current = hasMessages;
      
      if (hasMessages) {
        setMessages(initialMessages);
        parseMessages(initialMessages, false);
      }
      
      initialMessagesProcessedRef.current = true;
    }
    
    return () => {
      stop();
      chatStore.setKey('started', false);
      chatStore.setKey('aborted', false);
      animationCompleteRef.current = false;
      messageProcessingRef.current = false;
      initialMessagesProcessedRef.current = false;
      errorRecoveryRef.current = false;
    };
  }, [initialMessages]);

  useEffect(() => {
    // Only parse and store new messages if not in error recovery
    if (!errorRecoveryRef.current) {
      parseMessages(messages, isLoading);

      // Only store messages if we're not in the initial loading state and have new messages
      if (!messageProcessingRef.current && messages.length > initialMessages.length) {
        storeMessageHistory(messages).catch((error) => {
          console.error('Failed to store message history:', error);
          toast.error('Failed to save chat history');
        });
      }
    }
  }, [messages, isLoading, parseMessages]);

  const scrollTextArea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  const abort = () => {
    stop();
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();
    messageProcessingRef.current = false;
    errorRecoveryRef.current = false;
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
      textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  }, [input, textareaRef, TEXTAREA_MAX_HEIGHT]);

  const runAnimation = async () => {
    if (chatStarted || animationCompleteRef.current) {
      return true;
    }

    try {
      await Promise.all([
        animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
        animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
      ]);

      chatStore.setKey('started', true);
      setChatStarted(true);
      animationCompleteRef.current = true;
      
      // Small delay to ensure UI is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      logger.error('Animation failed', error);
      return false;
    }
  };

  const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
    const _input = messageInput || input;

    if (_input.length === 0 || isLoading || messageProcessingRef.current || errorRecoveryRef.current) {
      return;
    }

    try {
      messageProcessingRef.current = true;

      // Ensure animation is complete before proceeding
      if (!animationCompleteRef.current) {
        const success = await runAnimation();
        if (!success) {
          messageProcessingRef.current = false;
          toast.error('Failed to initialize chat');
          return;
        }
      }

      await workbenchStore.saveAllFiles();

      const fileModifications = workbenchStore.getFileModifcations();
      chatStore.setKey('aborted', false);

      if (fileModifications !== undefined) {
        const diff = fileModificationsToHTML(fileModifications);
        append({ role: 'user', content: `${diff}\n\n${_input}` });
        workbenchStore.resetAllFileModifications();
      } else {
        append({ role: 'user', content: _input });
      }

      setInput('');
      resetEnhancer();
      textareaRef.current?.blur();
    } catch (error) {
      logger.error('Failed to send message', error);
      toast.error('Failed to send message');
      messageProcessingRef.current = false;
    }
  };

  const [messageRef, scrollRef] = useSnapScroll();

  return (
    <BaseChat
      ref={animationScope}
      textareaRef={textareaRef}
      input={input}
      showChat={showChat}
      chatStarted={chatStarted}
      isStreaming={isLoading}
      enhancingPrompt={enhancingPrompt}
      promptEnhanced={promptEnhanced}
      sendMessage={sendMessage}
      messageRef={messageRef}
      scrollRef={scrollRef}
      handleInputChange={handleInputChange}
      handleStop={abort}
      messages={messages.map((message, i) => {
        if (message.role === 'user') {
          return message;
        }

        return {
          ...message,
          content: parsedMessages[i] || '',
        };
      })}
      enhancePrompt={() => {
        enhancePrompt(input, (input) => {
          setInput(input);
          scrollTextArea();
        });
      }}
    />
  );
});
