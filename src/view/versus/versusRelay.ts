// The online wire (docs/versus.md §2): a Supabase Realtime topic per room, Broadcast for the
// messages and Presence for who is in it. Broadcast keeps no history, so this side's whole log
// goes again whenever the friend appears and whenever this side's channel rejoins (§2.1).

import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js';
import type { Side } from '../../engine/state';
import { otherSide, type VersusMessage } from '../../run/versus';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../app/telemetry';
import { channelCore, envelope, type ChannelStatus, type VersusChannel } from './versusChannel';

const EVENT = 'm';

let client: RealtimeClient | null = null;
function realtime(): RealtimeClient {
  client ??= new RealtimeClient(`${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1`, { params: { apikey: SUPABASE_ANON_KEY } });
  return client;
}

export function openRelayChannel(code: string, side: Side): VersusChannel {
  const core = channelCore(side);
  const friend = otherSide(side);
  let status: ChannelStatus = 'connecting';
  let presence: Record<Side, number> = { A: 0, B: 0 };
  let friendWasHere = false;
  let synced = false;

  const channel: RealtimeChannel = realtime().channel(`versus:${code}`, {
    config: { broadcast: { self: false }, presence: { key: side, enabled: true } },
  });

  const transmit = (message: VersusMessage) => {
    if (status !== 'ready') return;
    void channel.send({ type: 'broadcast', event: EVENT, payload: envelope(side, message) });
  };
  const resendAll = () => core.outbox.forEach(transmit);

  channel.on('broadcast', { event: EVENT }, ({ payload }) => core.deliver(payload));
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    presence = { A: state.A?.length ?? 0, B: state.B?.length ?? 0 };
    synced = true;
    const here = presence[friend] > 0;
    if (here && !friendWasHere) resendAll();
    friendWasHere = here;
    core.notify();
  });
  channel.subscribe((state) => {
    if (state === 'SUBSCRIBED') {
      status = 'ready';
      void channel.track({ side });
      resendAll();
    } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
      status = 'error';
    }
    core.notify();
  });

  return {
    side,
    code,
    timed: true,
    send: (message) => {
      core.record(message);
      transmit(message);
    },
    inbox: core.inbox,
    status: () => status,
    presence: () => (synced ? presence : null),
    friendHere: () => presence[friend] > 0,
    subscribe: core.subscribe,
    close: () => {
      core.clear();
      void realtime().removeChannel(channel);
    },
  };
}
