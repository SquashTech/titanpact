// A versus room's wire (docs/versus.md §2). Step 1 is two tabs of one browser on a
// BroadcastChannel; the relay replaces this file's insides and nothing that reads it.

import type { Side } from '../../engine/state';
import type { VersusMessage } from '../../run/versus';

export interface VersusChannel {
  side: Side;
  code: string;
  send(message: VersusMessage): void;
  /** Everything the other side has sent since the room opened, oldest first. */
  inbox(): readonly VersusMessage[];
  subscribe(listener: () => void): () => void;
  close(): void;
}

interface Envelope {
  from: Side;
  message: VersusMessage;
}

/** Four letters, no lookalikes: read across a desk or a chat. */
export function newRoomCode(): string {
  const letters = 'ACDEFHJKMNPRTWXY';
  return Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
}

export const normaliseRoomCode = (text: string) => text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

export function openVersusChannel(code: string, side: Side): VersusChannel {
  const wire = new BroadcastChannel(`titanpact-versus-${code}`);
  const received: VersusMessage[] = [];
  const listeners = new Set<() => void>();
  wire.onmessage = (event: MessageEvent<Envelope>) => {
    if (event.data?.from === side) return;
    received.push(event.data.message);
    for (const listener of [...listeners]) listener();
  };
  return {
    side,
    code,
    send: (message) => wire.postMessage({ from: side, message } satisfies Envelope),
    inbox: () => received,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => {
      listeners.clear();
      wire.close();
    },
  };
}
