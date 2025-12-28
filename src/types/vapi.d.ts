declare module '@vapi-ai/web' {
  export interface VapiEventMap {
    'call-start': () => void;
    'call-end': () => void;
    'speech-start': () => void;
    'speech-end': () => void;
    'error': (error: { message: string }) => void;
    'message': (message: any) => void;
    'volume-level': (level: number) => void;
  }

  export interface AssistantOverrides {
    firstMessage?: string;
    backgroundMessage?: string;
    variableValues?: Record<string, any>;
    [key: string]: any;
  }

  export interface VapiStartOptions {
    assistantOverrides?: AssistantOverrides;
    [key: string]: any;
  }

  export default class Vapi {
    constructor(apiKey: string);
    
    start(assistantId: string, options?: VapiStartOptions): Promise<void>;
    stop(): void;
    
    on<K extends keyof VapiEventMap>(event: K, handler: VapiEventMap[K]): void;
    off<K extends keyof VapiEventMap>(event: K, handler: VapiEventMap[K]): void;
    
    isMuted(): boolean;
    setMuted(muted: boolean): void;
  }
}

