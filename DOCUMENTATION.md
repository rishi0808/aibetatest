# Bolt Technical Documentation

[Previous sections remain unchanged...]

## Core Systems

[Previous core systems sections remain unchanged...]

### 5. Persistence Layer

The persistence layer handles data storage using IndexedDB for chat history and related data.

#### Database Implementation (`app/lib/persistence/db.ts`)

```typescript
// Database initialization
async function openDatabase(): Promise<IDBDatabase | undefined> {
  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 1);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('chats')) {
        const store = db.createObjectStore('chats', { keyPath: 'id' });
        store.createIndex('id', 'id', { unique: true });
        store.createIndex('urlId', 'urlId', { unique: true });
      }
    };
  });
}

// Database operations
async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    const request = store.put({
      id,
      messages,
      urlId,
      description,
      timestamp: new Date().toISOString(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
```

Features:
- IndexedDB-based storage
- Chat history persistence
- URL-based chat retrieval
- Error handling and logging
- Automatic database upgrades

#### Chat History Hook (`app/lib/persistence/useChatHistory.ts`)

The useChatHistory hook manages chat history persistence and retrieval:

```typescript
export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  // Hook implementation
  return {
    ready: !mixedId || ready,
    initialMessages,
    storeMessageHistory: async (messages: Message[]) => {
      if (!db || messages.length === 0) {
        return;
      }

      // Store message history
      await setMessages(db, chatId.get() as string, messages, 
        urlId, description.get());
    },
  };
}
```

Features:
- Message history management
- URL-based navigation
- State synchronization
- Error handling
- Persistence configuration

### Data Models

#### 1. Chat History Item
```typescript
interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}
```

#### 2. Message Structure
```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
}
```

### Database Operations

#### 1. Message Operations
```typescript
// Get all chat history
async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
    request.onerror = () => reject(request.error);
  });
}

// Get messages by ID
async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return (await getMessagesById(db, id)) || 
    (await getMessagesByUrlId(db, id));
}

// Delete messages
async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');
    const request = store.delete(id);

    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error);
  });
}
```

#### 2. URL ID Management
```typescript
async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  const idList = await getUrlIds(db);

  if (!idList.includes(id)) {
    return id;
  } else {
    let i = 2;
    while (idList.includes(`${id}-${i}`)) {
      i++;
    }
    return `${id}-${i}`;
  }
}
```

### Error Handling

#### 1. Database Errors
```typescript
request.onerror = (event: Event) => {
  resolve(undefined);
  logger.error((event.target as IDBOpenDBRequest).error);
};
```

#### 2. Persistence Errors
```typescript
if (!db) {
  setReady(true);
  if (persistenceEnabled) {
    toast.error(`Chat persistence is unavailable`);
  }
  return;
}
```

### State Management

#### 1. Chat State
```typescript
const chatId = atom<string | undefined>(undefined);
const description = atom<string | undefined>(undefined);
```

#### 2. History State
```typescript
const [initialMessages, setInitialMessages] = useState<Message[]>([]);
const [ready, setReady] = useState<boolean>(false);
const [urlId, setUrlId] = useState<string | undefined>();
```

### Navigation

```typescript
function navigateChat(nextId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;
  window.history.replaceState({}, '', url);
}
```

### Development Guidelines

#### 1. Database Best Practices
- Use transactions appropriately
- Handle all error cases
- Implement proper cleanup
- Version database schema changes
- Provide fallback mechanisms

#### 2. State Management Best Practices
- Keep persistence layer separate
- Handle loading states
- Provide error feedback
- Implement proper cleanup
- Use appropriate atoms for state

### Testing Strategies

#### 1. Database Tests
```typescript
describe('Database Operations', () => {
  it('should store and retrieve messages', async () => {
    const db = await openDatabase();
    const messages = [/* test messages */];
    await setMessages(db, 'test-id', messages);
    const retrieved = await getMessages(db, 'test-id');
    expect(retrieved.messages).toEqual(messages);
  });
});
```

#### 2. Hook Tests
```typescript
describe('useChatHistory', () => {
  it('should handle persistence disabled', () => {
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.ready).toBe(true);
  });
});
```

### Performance Considerations

1. Batch Operations
```typescript
// Batch multiple operations in a single transaction
const transaction = db.transaction('chats', 'readwrite');
const store = transaction.objectStore('chats');
await Promise.all([
  store.put(item1),
  store.put(item2),
  store.put(item3)
]);
```

2. Cleanup Strategy
```typescript
// Implement cleanup for old chat histories
async function cleanupOldChats(db: IDBDatabase): Promise<void> {
  const oldChats = await getChatsOlderThan(30); // 30 days
  const transaction = db.transaction('chats', 'readwrite');
  const store = transaction.objectStore('chats');
  
  for (const chat of oldChats) {
    await store.delete(chat.id);
  }
}
```

[Rest of the documentation remains unchanged...]
