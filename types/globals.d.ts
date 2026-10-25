/**
 * Ambient type declarations for CDN-loaded libraries and core data models in ABot.
 * These types are picked up automatically by TypeScript via jsconfig.json.
 */

// CDN-loaded Globals
declare const firebase: any;
declare const marked: any;
declare const hljs: any;
declare const google: any;
declare const VANTA: any;

interface Window {
  ABOT_VERSION?: string;
  __abotErrors?: string[];
  google?: any;
  firebase?: any;
  marked?: any;
  hljs?: any;
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
  __abotClicks?: any[];
}

// Core ABot Application Types (available globally in JSDoc)
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  model?: string;
  error?: boolean;
}

interface ChatSession {
  id: number | string;
  name: string;
  messages: ChatMessage[];
  createdAt?: number;
  updatedAt?: number;
  model?: string;
  systemPrompt?: string;
}

interface AppState {
  chats: Record<string, ChatSession>;
  activeChatId: string | null;
  abortController: AbortController | null;
  guestSessionMessageCount: number;
  isAppInitialized: boolean;
  recognition?: any;
  titleAnimationInterval: number | null;
  tokenClient?: any;
  auth: any;
  editMessageIndex?: number | null;
  db: any;
  toastTimeout: any;
  isStreaming: boolean;
  webSearchEnabled: boolean;
  thinkingEnabled: boolean;
}

interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  description?: string;
  badge?: string;
  supportsThinking?: boolean;
  supportsSearch?: boolean;
}
