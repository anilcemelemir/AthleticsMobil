import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';

import { API_BASE_URL, type MessageDto } from './api';

type MessageHandler = (msg: MessageDto) => void;
type TypingHandler = (senderId: number) => void;
type ReadHandler = (readerId: number) => void;
type ConnectionHandler = (connected: boolean) => void;

class ChatConnection {
  private connection: HubConnection | null = null;
  private token: string | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private typingHandlers = new Set<TypingHandler>();
  private readHandlers = new Set<ReadHandler>();
  private connectionHandlers = new Set<ConnectionHandler>();

  isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }

  async start(token: string): Promise<void> {
    if (this.connection && this.token === token && this.isConnected()) return;
    await this.stop();

    this.token = token;
    const hubUrl = `${API_BASE_URL}/hubs/chat`;
    console.log('[chat] connecting to', hubUrl);
    const conn = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => this.token ?? '',
        transport: HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 15000])
      .configureLogging(LogLevel.Warning)
      .build();

    conn.on('ReceiveMessage', (msg: MessageDto) => {
      this.messageHandlers.forEach((h) => {
        try {
          h(msg);
        } catch (e) {
          console.warn('chat handler', e);
        }
      });
    });

    conn.on('UserTyping', (payload: { senderId: number }) => {
      this.typingHandlers.forEach((h) => h(payload.senderId));
    });

    conn.on('MessagesRead', (payload: { readerId: number }) => {
      this.readHandlers.forEach((h) => h(payload.readerId));
    });

    conn.onreconnected(() => this.connectionHandlers.forEach((h) => h(true)));
    conn.onreconnecting(() => this.connectionHandlers.forEach((h) => h(false)));
    conn.onclose(() => this.connectionHandlers.forEach((h) => h(false)));

    this.connection = conn;
    try {
      await conn.start();
      console.log('[chat] connected, state =', conn.state);
      this.connectionHandlers.forEach((h) => h(true));
    } catch (err) {
      console.warn('[chat] start failed', err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.connection) return;
    try {
      await this.connection.stop();
    } catch {
      // ignore
    }
    this.connection = null;
    this.token = null;
    this.connectionHandlers.forEach((h) => h(false));
  }

  async send(receiverId: number, content: string): Promise<MessageDto | null> {
    if (!this.connection || !this.isConnected()) return null;
    return (await this.connection.invoke<MessageDto>(
      'SendMessage',
      receiverId,
      content,
    )) as MessageDto;
  }

  async typing(receiverId: number): Promise<void> {
    if (!this.connection || !this.isConnected()) return;
    try {
      await this.connection.invoke('Typing', receiverId);
    } catch {
      // ignore
    }
  }

  async markAsRead(otherUserId: number): Promise<void> {
    if (!this.connection || !this.isConnected()) return;
    try {
      await this.connection.invoke('MarkAsRead', otherUserId);
    } catch {
      // ignore
    }
  }

  onMessage(h: MessageHandler): () => void {
    this.messageHandlers.add(h);
    return () => this.messageHandlers.delete(h);
  }

  onTyping(h: TypingHandler): () => void {
    this.typingHandlers.add(h);
    return () => this.typingHandlers.delete(h);
  }

  onRead(h: ReadHandler): () => void {
    this.readHandlers.add(h);
    return () => this.readHandlers.delete(h);
  }

  onConnectionChange(h: ConnectionHandler): () => void {
    this.connectionHandlers.add(h);
    return () => this.connectionHandlers.delete(h);
  }
}

export const chatConnection = new ChatConnection();
