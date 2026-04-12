export interface IPCMessage {
  type: 'command' | 'response' | 'stream' | 'error';
  id: string;
  command?: string;
  args?: string[];
  options?: Record<string, unknown>;
  event?: string;
  data?: unknown;
  result?: unknown;
  error?: string;
}

export interface StreamEvent {
  round?: number;
  papers_found?: number;
  current_node?: string;
  status?: string;
  findings?: string[];
}

export function createMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createCommandMessage(
  command: string,
  args: string[] = [],
  options: Record<string, unknown> = {}
): IPCMessage {
  return {
    type: 'command',
    id: createMessageId(),
    command,
    args,
    options
  };
}

export function parseResponse(data: string): IPCMessage | null {
  try {
    const msg = JSON.parse(data);
    if (msg.type && msg.id) {
      return msg as IPCMessage;
    }
    return null;
  } catch {
    return null;
  }
}