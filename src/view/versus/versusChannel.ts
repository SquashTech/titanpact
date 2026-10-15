// A versus room's wire (docs/versus.md §2). One shape, two transports: the Supabase relay
// (versusRelay.ts) for two devices, and a BroadcastChannel for two tabs of one browser.

import type { Side } from '../../engine/state';
import { messageKey, type VersusMessage } from '../../run/versus';

export type ChannelStatus = 'connecting' | 'ready' | 'error';

export interface VersusChannel {
  side: Side;
  code: string;
  /** The relay runs both players' clocks; two tabs sits still for a test. */
  timed: boolean;
  send(message: VersusMessage): void;
  /** The first of each message the other side has sent since the room opened, oldest first. */
  inbox(): readonly VersusMessage[];
  status(): ChannelStatus;
  /** Clients in the room by side, this one included; null where the wire cannot tell (two tabs). */
  presence(): Record<Side, number> | null;
  /** Whether the friend is in the room now. */
  friendHere(): boolean;
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

/**
 * What both transports share (§2.1): everything this side sent is kept so it can all go again,
 * and of everything received only the first of each key is kept.
 */
export function channelCore(side: Side) {
  const outbox: VersusMessage[] = [];
  const received: VersusMessage[] = [];
  const keys = new Set<string>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  return {
    outbox,
    notify,
    record: (message: VersusMessage) => outbox.push(message),
    deliver: (envelope: Envelope | undefined) => {
      if (!envelope || envelope.from === side) return;
      const key = messageKey(envelope.message);
      if (keys.has(key)) return;
      keys.add(key);
      received.push(envelope.message);
      notify();
    },
    inbox: () => received,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear: () => listeners.clear(),
  };
}

export type ChannelCore = ReturnType<typeof channelCore>;
export const envelope = (from: Side, message: VersusMessage): Envelope => ({ from, message });

/** Two tabs of one browser: no Presence, no clock. */
export function openTabChannel(code: string, side: Side): VersusChannel {
  const wire = new BroadcastChannel(`titanpact-versus-${code}`);
  const core = channelCore(side);
  wire.onmessage = (event: MessageEvent<Envelope>) => core.deliver(event.data);
  return {
    side,
    code,
    timed: false,
    send: (message) => {
      core.record(message);
      wire.postMessage(envelope(side, message));
    },
    inbox: core.inbox,
    status: () => 'ready',
    presence: () => null,
    friendHere: () => true,
    subscribe: core.subscribe,
    close: () => {
      core.clear();
      wire.close();
    },
  };
}
