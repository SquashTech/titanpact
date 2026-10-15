// Versus (docs/versus.md): a room by code, each player's own Gauntlet draft off one seed, both
// sixes shown, then one fight flown from two screens. The rules are run/versus.ts's.

import { useEffect, useMemo, useRef, useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { typeChart } from '../../data/typechart';
import { locations } from '../../data/locations';
import { constructedContent } from '../../data/trials';
import type { Side } from '../../engine/state';
import { constructedSide, TEAM_SIZE, type TeamSlot } from '../../run/constructed';
import type { GauntletContent } from '../../run/gauntlet';
import { arenaLocationIds } from '../../run/locations';
import { buildsMatch, contentStamp, GUEST_SIDE, HOST_SIDE, otherSide, VERSUS_CLOCK, versusDraft, versusPool, type VersusMessage } from '../../run/versus';
import { FightScreen } from '../combat/FightScreen';
import { LocationProvider } from '../shared/LocationContext';
import { PlateButton } from '../shared/PlateButton';
import { Back, DraftView, Header, HeroSheet, Strip } from '../run/GauntletScreen';
import { newRoomCode, normaliseRoomCode, openTabChannel, type VersusChannel } from './versusChannel';
import { openRelayChannel } from './versusRelay';
import { TurnClock, useTurnClock } from './TurnClock';
import './versus.css';

const content: GauntletContent = { ...constructedContent, typeChart };
const ME = { stamp: contentStamp(Object.keys(heroes), Object.keys(moves)), build: __BUILD_SHA__ };
const HELLO_EVERY_MS = 800;
/** How long a guest looks for the host before saying there is no such room. */
const FIND_ROOM_MS = 8000;
/** Codes a host tries before giving up on finding an empty room. */
const CLAIM_TRIES = 5;
const DIFFERENT_BUILD = 'Your friend is on a different version of the game. Both of you reload it and try again.';

interface Props {
  /** This player's owned heroes; the draft deals from both players' together. */
  owned: string[];
  /** Two tabs of one browser (the Dev menu), in place of the relay. */
  local?: boolean;
  onClose: () => void;
}

type Room =
  | { kind: 'lobby'; error?: string }
  | { kind: 'claiming'; tries: number }
  | { kind: 'hosting' }
  | { kind: 'joining'; since: number }
  | { kind: 'match'; seed: number; pool: string[] }
  | { kind: 'over'; line: string };

type Stage = 'draft' | 'preview' | 'fight' | 'result';

const findSeed = (inbox: readonly VersusMessage[]) => inbox.find((m): m is Extract<VersusMessage, { kind: 'seed' }> => m.kind === 'seed');
const findHello = (inbox: readonly VersusMessage[]) => inbox.find((m): m is Extract<VersusMessage, { kind: 'hello' }> => m.kind === 'hello');

export function VersusScreen({ owned, local = false, onClose }: Props) {
  const [channel, setChannel] = useState<VersusChannel | null>(null);
  const [room, setRoom] = useState<Room>({ kind: 'lobby' });
  const [codeInput, setCodeInput] = useState('');
  const [tick, setTick] = useState(0);
  const hostSeed = useRef<number | null>(null);

  const open = (code: string, side: Side) => (local ? openTabChannel(code, side) : openRelayChannel(code, side));

  useEffect(() => (channel ? channel.subscribe(() => setTick((n) => n + 1)) : undefined), [channel]);
  useEffect(() => () => channel?.close(), [channel]);

  function fail(error: string) {
    channel?.close();
    setChannel(null);
    setRoom({ kind: 'lobby', error });
  }

  useEffect(() => {
    if (!channel) return;
    const inbox = channel.inbox();
    if (inbox.some((m) => m.kind === 'leave') && room.kind !== 'over' && room.kind !== 'match') {
      setRoom({ kind: 'over', line: 'Your friend left the room.' });
      return;
    }
    if (channel.status() === 'error' && room.kind !== 'match') return fail('Could not reach the server. Check the connection and try again.');
    const presence = channel.presence();

    if (room.kind === 'claiming') {
      // A code someone is already in is rolled again (§2.2).
      if (!presence) return;
      if (presence.A <= 1 && presence.B === 0) return setRoom({ kind: 'hosting' });
      channel.close();
      if (room.tries + 1 >= CLAIM_TRIES) return fail('Could not find a free room. Try again.');
      setChannel(open(newRoomCode(), HOST_SIDE));
      setRoom({ kind: 'claiming', tries: room.tries + 1 });
    } else if (room.kind === 'hosting') {
      const hello = findHello(inbox);
      if (!hello) return;
      if (!buildsMatch(ME, hello)) return fail(DIFFERENT_BUILD);
      hostSeed.current ??= Math.floor(Math.random() * 0x100000000);
      channel.send({ kind: 'seed', seed: hostSeed.current, owned, ...ME });
      setRoom({ kind: 'match', seed: hostSeed.current, pool: versusPool(owned, hello.owned) });
    } else if (room.kind === 'joining') {
      if (presence && presence.B > 1) return fail('That room already has two players.');
      if (presence && presence.A === 0 && Date.now() - room.since > FIND_ROOM_MS) return fail('No room with that code.');
      const seed = findSeed(inbox);
      if (!seed) return;
      if (!buildsMatch(ME, seed)) return fail(DIFFERENT_BUILD);
      setRoom({ kind: 'match', seed: seed.seed, pool: versusPool(seed.owned, owned) });
    }
  }, [tick, channel, room.kind]);

  // The guest says hello until a seed comes back; the same beat re-checks whether the room is there.
  useEffect(() => {
    if (!channel || room.kind !== 'joining') return;
    const hello = () => {
      channel.send({ kind: 'hello', owned, ...ME });
      setTick((n) => n + 1);
    };
    hello();
    const timer = window.setInterval(hello, HELLO_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [channel, room.kind]);

  function host() {
    setChannel(open(newRoomCode(), HOST_SIDE));
    setRoom(local ? { kind: 'hosting' } : { kind: 'claiming', tries: 0 });
  }

  function join() {
    const code = normaliseRoomCode(codeInput);
    if (code.length < 4) return;
    setChannel(open(code, GUEST_SIDE));
    setRoom({ kind: 'joining', since: Date.now() });
  }

  function leave() {
    channel?.send({ kind: 'leave' });
    // A beat for the leave to go out before the socket closes.
    const closing = channel;
    window.setTimeout(() => closing?.close(), 500);
    onClose();
  }

  function backToLobby() {
    channel?.close();
    setChannel(null);
    hostSeed.current = null;
    setRoom({ kind: 'lobby' });
  }

  if (room.kind === 'match' && channel) return <Match channel={channel} seed={room.seed} pool={room.pool} onLeave={leave} />;

  return (
    <div className="node-screen cx-screen gx-screen">
      <Header title="Versus" />
      <div className="screen-scroll gx-entry vs-lobby">
        {room.kind === 'lobby' && (
          <>
            <p className="gx-entry-copy">Draft six against a friend, each from three heroes at a time, then fight once.</p>
            {room.error && <p className="vs-error">{room.error}</p>}
            <div className="vs-join">
              <input
                className="vs-code-input selectable"
                value={codeInput}
                placeholder="CODE"
                aria-label="Room code"
                maxLength={4}
                onChange={(e) => setCodeInput(normaliseRoomCode(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && join()}
              />
              <button type="button" className="secondary-button" disabled={normaliseRoomCode(codeInput).length < 4} onClick={join}>
                Join
              </button>
            </div>
          </>
        )}
        {room.kind === 'claiming' && <p className="gx-entry-copy">Opening a room…</p>}
        {room.kind === 'hosting' && channel && (
          <>
            <p className="gx-entry-copy">Give your friend this code.</p>
            <div className="vs-code">{channel.code}</div>
          </>
        )}
        {room.kind === 'joining' && <p className="gx-entry-copy">Looking for the room…</p>}
        {room.kind === 'over' && <p className="gx-entry-copy">{room.line}</p>}
      </div>
      <div className={`gx-footer${room.kind === 'lobby' ? '' : ' is-back-only'}`}>
        <Back label="Back" onClick={room.kind === 'lobby' || room.kind === 'over' ? onClose : backToLobby} />
        {room.kind === 'lobby' && <PlateButton onClick={host}>Host a room</PlateButton>}
      </div>
    </div>
  );
}

function Match({ channel, seed, pool, onLeave }: { channel: VersusChannel; seed: number; pool: string[]; onLeave: () => void }) {
  const mySide = channel.side;
  const [picks, setPicks] = useState<number[]>([]);
  const [stage, setStage] = useState<Stage>('draft');
  const [outcome, setOutcome] = useState<'win' | 'loss' | null>(null);
  const [desync, setDesync] = useState<number | null>(null);
  const [reading, setReading] = useState<TeamSlot | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => channel.subscribe(() => setTick((n) => n + 1)), [channel]);

  const mine = useMemo(() => versusDraft(content, pool, seed, mySide, picks), [pool, seed, mySide, picks]);
  const theirPicks = channel
    .inbox()
    .filter((m): m is Extract<VersusMessage, { kind: 'pick' }> => m.kind === 'pick')
    .sort((a, b) => a.n - b.n)
    .map((m) => m.index);
  const theirsDone = theirPicks.length >= TEAM_SIZE;
  const theirs = useMemo(() => (theirsDone ? versusDraft(content, pool, seed, otherSide(mySide), theirPicks.slice(0, TEAM_SIZE)) : null), [theirsDone, tick]);
  const left = channel.inbox().some((m) => m.kind === 'leave');
  const dropped = channel.timed && !channel.friendHere() && stage !== 'result';

  const arena = useMemo(() => {
    const ids = arenaLocationIds();
    return ids.length > 0 ? locations[ids[seed % ids.length]] ?? null : null;
  }, [seed]);
  const fight = useMemo(
    () => (stage === 'fight' && theirs ? { me: constructedSide(constructedContent, { name: 'You', slots: mine.team }), them: constructedSide(constructedContent, { name: 'Friend', slots: theirs.team }) } : null),
    [stage, theirs]
  );

  function draft(index: number) {
    channel.send({ kind: 'pick', n: picks.length, index });
    const next = [...picks, index];
    setPicks(next);
    setReading(null);
    if (next.length >= TEAM_SIZE) setStage('preview');
  }

  // The draft and the preview run on the pick clock (§3); a pick that runs out takes the first offer.
  const clockKey = !channel.timed ? null : stage === 'draft' ? `draft:${picks.length}` : stage === 'preview' && theirs ? 'preview' : null;
  const clockLeft = useTurnClock(clockKey, VERSUS_CLOCK.pick, dropped, () => (stage === 'draft' ? draft(0) : setStage('fight')));

  const droppedNote = dropped && <div className="vs-dropped">Your friend’s connection dropped. Waiting for them…</div>;

  if (left && stage !== 'result') {
    return (
      <div className="node-screen cx-screen gx-screen">
        <Header title="Versus" />
        <div className="screen-scroll gx-entry">
          <p className="gx-entry-copy">Your friend left. The match is yours.</p>
        </div>
        <div className="gx-footer is-back-only">
          <Back label="Back to the title" onClick={onLeave} />
        </div>
      </div>
    );
  }

  if (stage === 'fight' && fight) {
    return (
      <LocationProvider location={arena}>
        <FightScreen
          playerRun={fight.me.run}
          playerSquad={fight.me.squad}
          aiRun={fight.them.run}
          aiSquad={fight.them.squad}
          goldReward={0}
          xpGained={0}
          equipmentReward={null}
          versus={{ channel, seed, onDesync: setDesync }}
          onResolved={(result) => {
            setOutcome(result);
            setStage('result');
          }}
          onExitToTitle={onLeave}
          exitLabel="Concede the match"
        />
        {droppedNote}
        {desync !== null && <div className="vs-desync">{`Out of step with your friend after round ${desync}.`}</div>}
      </LocationProvider>
    );
  }

  return (
    <div className="node-screen cx-screen gx-screen">
      <TurnClock left={reading ? null : clockLeft} total={VERSUS_CLOCK.pick} className="vs-screen-clock" />
      {droppedNote}
      {reading ? (
        <HeroSheet slot={reading} stars={null} onBack={() => setReading(null)} />
      ) : stage === 'draft' ? (
        <DraftView run={mine} stars={null} onDraft={draft} onClose={onLeave} />
      ) : stage === 'result' ? (
        <>
          <Header title={outcome === 'win' ? 'You won' : 'Your friend won'} />
          <div className="screen-scroll gx-between" />
          <div className="gx-footer is-back-only">
            <Back label="Back to the title" onClick={onLeave} />
          </div>
        </>
      ) : (
        <>
          <Header title="Versus" />
          <div className="screen-scroll gx-between">
            <div className="cx-team-row gx-side">
              <span className="cx-label">Your six</span>
              <Strip slots={mine.team} onOpen={(i) => setReading(mine.team[i])} />
            </div>
            <div className="cx-team-row gx-side">
              <span className="cx-label">Your friend’s six</span>
              {theirs ? <Strip slots={theirs.team} onOpen={(i) => setReading(theirs.team[i])} /> : <span className="vs-waiting">Still drafting…</span>}
            </div>
          </div>
          <div className="gx-footer">
            <Back label="Leave the match" onClick={onLeave} />
            <PlateButton disabled={!theirs} onClick={() => setStage('fight')}>
              To the field
            </PlateButton>
          </div>
        </>
      )}
    </div>
  );
}
