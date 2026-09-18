// Exports every move and every Evolution as readable Markdown for a balance pass, meant to be
// edited by hand and handed back — the edits are read by a person, not parsed.
//
//   node dist/scripts/exportBalance.js            writes docs/balance/moves.md and heroes.md
//
// moves.md  — the catalog by type slate: one row a move, the whole payload in one Effect column,
//             signatures inside their type, Class moves at the end.
// heroes.md — one section a hero: stats, grades, schedule, kit, pool by band, signature, and the
//             three Evolution paths side by side.

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { classes, classMoves } from '../src/data/classes';
import { signatureMoves } from '../src/data/signatures';
import { passives } from '../src/data/passives';
import { statuses } from '../src/data/statuses';
import { fieldEffects } from '../src/data/fieldEffects';
import { progressionTable } from '../src/data/progression';
import { TYPES } from '../src/data/typechart';
import type { HeroDefinition, MoveDefinition, StatKey, StatusApplication } from '../src/engine/content';
import { statusApplicationsOf } from '../src/engine/content';
import type { EvolutionPath } from '../src/run/progression';
import { scheduleFor } from '../src/run/progression';
import { heroStatTotal } from '../src/run/statBudget';

const STAT_ABBR: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Atk',
  defense: 'Def',
  intelligence: 'Int',
  wisdom: 'Wis',
  speed: 'Spd',
  manaPool: 'Mana',
  mpRegen: 'MPR',
};
const STAT_ORDER: StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool', 'mpRegen'];

const TARGET_LABEL: Record<string, string> = {
  singleEnemy: 'enemy',
  singleAlly: 'ally',
  self: 'self',
  bothEnemies: 'both enemies',
  bothAllies: 'both allies',
  allOthers: 'all others',
  randomAlly: 'random ally',
  randomEnemy: 'random enemy',
};
const RIDER_TARGET_LABEL: Record<string, string> = {
  self: 'self',
  moveTarget: 'target',
  bothAllies: 'both allies',
  randomAlly: 'random ally',
  randomEnemy: 'random enemy',
};

const TIER_LABEL: Record<string, string> = { early: 'Early', mid: 'Mid', late: 'Late' };

function statusName(id: string): string {
  return statuses[id]?.name ?? id;
}
function fieldName(id: string): string {
  return fieldEffects[id]?.name ?? id;
}
function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function signed(n: number): string {
  return n >= 0 ? `+${n}` : `−${-n}`;
}
function statGrants(grants: Partial<Record<StatKey, number>>): string {
  const parts = STAT_ORDER.filter((s) => grants[s] !== undefined && grants[s] !== 0).map(
    (s) => `${signed(grants[s]!)} ${STAT_ABBR[s]}`
  );
  return parts.length ? parts.join(', ') : '—';
}

/** Where a rider lands, or nothing when it lands on the move's own targets — the Target column says so. */
function landsOn(target: string, move: MoveDefinition): string {
  if (target === 'moveTarget' || target === move.target) return '';
  return ` → ${RIDER_TARGET_LABEL[target] ?? target}`;
}

function rider(app: StatusApplication, move: MoveDefinition): string {
  const bits: string[] = [];
  if (app.chance !== undefined && app.chance < 1) bits.push(`${pct(app.chance)}:`);
  bits.push(statusName(app.statusId));
  if (app.magnitude !== undefined) bits.push(String(app.magnitude));
  if (app.duration !== undefined) bits.push(`${app.duration}r`);
  return bits.join(' ') + landsOn(app.target, move);
}

function conditionOf(c: NonNullable<MoveDefinition['conditionalPower']>): string {
  if (c.requiresTargetStatus) return `target has ${statusName(c.requiresTargetStatus)}`;
  if (c.requiresUserStatus) return `user has ${statusName(c.requiresUserStatus)}`;
  if (c.requiresFieldEffect) return `under ${fieldName(c.requiresFieldEffect)}`;
  if (c.requiresTargetHpBelow !== undefined) return `target < ${pct(c.requiresTargetHpBelow)} HP`;
  if (c.requiresTargetStatReduction) return 'target debuffed';
  if (c.requiresUserHpBelow !== undefined) return `user < ${pct(c.requiresUserHpBelow)} HP`;
  if (c.requiresPartnerType) return `partner is ${c.requiresPartnerType}`;
  return '?';
}

/** Every rider on the move, in one readable clause list. */
function effect(m: MoveDefinition): string {
  const out: string[] = [];
  if (m.randomBasePower) out.push(`Pow rolled ${m.randomBasePower.min}–${m.randomBasePower.max}`);
  if (m.hitCount && m.hitCount > 1) out.push(`×${m.hitCount} hits`);
  if (m.critChance !== undefined) out.push(`${pct(m.critChance)} crit`);
  if (m.offStatOverride) out.push(`swings with ${STAT_ABBR[m.offStatOverride]}`);
  if (m.conditionalPower) {
    const c = m.conditionalPower;
    out.push(`×${c.multiplier} if ${conditionOf(c)}${c.consumesStatus ? ' (consumes it)' : ''}`);
  }
  if (m.basePowerGainOnUse) out.push(`+${m.basePowerGainOnUse.amount} Pow each cast (max +${m.basePowerGainOnUse.max})`);
  if (m.retributionPercent !== undefined) out.push(`deals ${pct(m.retributionPercent)} of damage taken since last turn (fixed)`);
  if (m.drainPercent !== undefined) out.push(`drain ${pct(m.drainPercent)}`);
  if (m.recoilPercent !== undefined) out.push(`recoil ${pct(m.recoilPercent)}`);
  if (m.selfHpCost) {
    out.push(
      m.selfHpCost.mode === 'percentMaxHp'
        ? `costs ${pct(m.selfHpCost.amount)} max HP`
        : `drops user to ${m.selfHpCost.amount} HP`
    );
  }
  if (m.healPower !== undefined) out.push(`Heal ${m.healPower}`);
  if (m.statDeltas && m.statDeltas.length) {
    const chance = m.statDeltaChance !== undefined && m.statDeltaChance < 1 ? `${pct(m.statDeltaChance)}: ` : '';
    const deltas = m.statDeltas.map((d) => `${signed(d.amount)} ${STAT_ABBR[d.stat]}`).join(', ');
    let s = `${chance}${deltas}${landsOn(m.statDeltaTarget ?? 'moveTarget', m)}`;
    if (m.conditionalStatDeltas) s += ` (×${m.conditionalStatDeltas.multiplier} if partner is ${m.conditionalStatDeltas.requiresPartnerType})`;
    out.push(s);
  }
  if (m.randomStatDeltas) {
    const r = m.randomStatDeltas;
    out.push(`${signed(r.amount)} to ${r.count >= r.from.length ? 'every' : r.count} random stat${r.count === 1 ? '' : 's'}${landsOn(m.statDeltaTarget ?? 'moveTarget', m)}`);
  }
  if (m.derivedStatDeltas) {
    const src = m.derivedStatDeltas.source === 'userManaBeforeCast' ? 'mana before the cast' : 'own current Atk';
    out.push(`+${m.derivedStatDeltas.stats.map((s) => STAT_ABBR[s]).join('/')} equal to ${src}`);
  }
  if (m.manaGrant !== undefined) out.push(`+${m.manaGrant} mana`);
  for (const app of statusApplicationsOf(m)) out.push(rider(app, m));
  if (m.randomStatusApplication) out.push(`one of: ${m.randomStatusApplication.map((app) => rider(app, m)).join(' / ')}`);
  if (m.cleanses) out.push(m.cleanseCount ? `cleanse ${m.cleanseCount}` : 'cleanse all');
  if (m.detonatesStatus) out.push(`detonates ${statusName(m.detonatesStatus)}`);
  if (m.fieldEffectApplication) out.push(`sets ${fieldName(m.fieldEffectApplication)}`);
  if (m.requiresTargetStatus) out.push(`only on a target with ${statusName(m.requiresTargetStatus)}`);
  if (m.conditionalTarget) out.push(`→ ${TARGET_LABEL[m.conditionalTarget.target]} under ${fieldName(m.conditionalTarget.requiresFieldEffect)}`);
  if (m.conditionalManaCost) {
    const c = m.conditionalManaCost;
    const cond = c.requiresAllEnemiesStatus
      ? `all enemies have ${statusName(c.requiresAllEnemiesStatus)}`
      : c.requiresAnyEnemyStatus
        ? `an enemy has ${statusName(c.requiresAnyEnemyStatus)}`
        : `partner is ${c.requiresPartnerType}`;
    out.push(`costs ${c.manaCost} if ${cond}`);
  }
  if (m.manaDiscountOnUse !== undefined) out.push(`−${m.manaDiscountOnUse} mana each cast`);
  if (m.manaCostGainOnUse !== undefined) out.push(`+${m.manaCostGainOnUse} mana each cast`);
  if (m.randomPriority) out.push(`prio one of ${m.randomPriority.map(signed).join('/')}`);
  if (m.conditionalPriority) out.push(`${signed(m.conditionalPriority.bonus)} prio vs ${statusName(m.conditionalPriority.requiresTargetStatus)}`);
  if (m.switchesUserOut) out.push('then switches out');
  if (m.typeFollowsUser) out.push('wears the user’s type');
  return out.join('; ') || '—';
}

// --- Who uses what -----------------------------------------------------------------------

interface Usage {
  kit: string[];
  pool: string[];
  evo: string[];
  learnable: string[];
  sig: string[];
}
const usage: Record<string, Usage> = {};
function use(moveId: string, key: keyof Usage, who: string): void {
  const u = (usage[moveId] ??= { kit: [], pool: [], evo: [], learnable: [], sig: [] });
  if (!u[key].includes(who)) u[key].push(who);
}
const heroList = Object.values(heroes);
for (const h of heroList) {
  for (const id of h.moveIds) use(id, 'kit', h.name);
  for (const id of progressionTable.moveTiers[h.id] ?? []) use(id, 'pool', h.name);
  for (const node of progressionTable.evolutions[h.id] ?? [])
    for (const p of node.paths) {
      for (const id of p.unlocksMoveIds) use(id, 'evo', `${h.name}/${p.name}`);
      for (const id of p.learnableMoveIds ?? []) use(id, 'learnable', `${h.name}/${p.name}`);
    }
  if (h.signatureMoveId) use(h.signatureMoveId, 'sig', h.name);
}

function usedBy(id: string): string {
  const u = usage[id];
  if (!u) return 'enemy-only';
  const parts: string[] = [];
  if (u.kit.length) parts.push(`kit: ${u.kit.join(', ')}`);
  if (u.pool.length) parts.push(`pool: ${u.pool.join(', ')}`);
  if (u.evo.length) parts.push(`evo grant: ${u.evo.join(', ')}`);
  if (u.learnable.length) parts.push(`evo pool: ${u.learnable.join(', ')}`);
  if (u.sig.length) parts.push(`signature: ${u.sig.join(', ')}`);
  return parts.join(' · ') || 'enemy-only';
}

// --- moves.md ----------------------------------------------------------------------------

function cell(s: string): string {
  return s.replace(/\|/g, '\\|');
}

const MOVE_HEADER = '| Move | Tier | Cat | Kind | Pow | Mana | Pri | Target | Effect | Used by |\n|---|---|---|---|---|---|---|---|---|---|';

function moveRow(m: MoveDefinition, tierLabel?: string): string {
  const tier = tierLabel ?? (m.tier ? TIER_LABEL[m.tier] : '—');
  const cat = m.category === 'physical' ? 'Phy' : 'Mag';
  const pow = m.basePower !== undefined ? String(m.basePower) : '—';
  return `| ${cell(m.name)} | ${tier} | ${cat} | ${m.kind} | ${pow} | ${m.manaCost} | ${signed(m.priority)} | ${TARGET_LABEL[m.target]} | ${cell(effect(m))} | ${cell(usedBy(m.id))} |`;
}

const tierRank: Record<string, number> = { early: 0, mid: 1, late: 2 };
function bySlateOrder(a: MoveDefinition, b: MoveDefinition): number {
  const ta = tierRank[a.tier ?? 'early'];
  const tb = tierRank[b.tier ?? 'early'];
  if (ta !== tb) return ta - tb;
  return a.manaCost - b.manaCost || a.name.localeCompare(b.name);
}

function movesDoc(): string {
  const lines: string[] = [];
  lines.push('# Moves — balance pass');
  lines.push('');
  lines.push('Generated by `scripts/exportBalance.ts` from `src/data/moves.ts`, `signatures.ts` and `classes.ts`. Edit anything in place; the edits are read back by hand and applied to the data (descriptions are fixed up to match on the way in).');
  lines.push('');
  lines.push('**Reading a row.** Pow is BasePower (damage = Pow × off/def ratio × STAB 1.25 × type × 0.85–1.0 variance × crit). Heal N is HealPower (× Wisdom mult × STAB, no variance). A stat delta or a DoT/HoT/Shield magnitude is a BASE that scales off the caster (Wisdom for a buff/heal/Shield-off-Defense; the move’s offensive stat for a debuff/DoT), except a self-cost, which lands flat. `Xr` on a status is its duration in rounds. A rider with no `→` lands on the move’s own target; `→ self` / `→ both allies` says otherwise.');
  lines.push('');
  lines.push('**Conventions in force** (`docs/authoring-moves.md`): a single-target Late is 55+ mana, a spread Late 65+, a spread Mid 60+; signatures 45–60; the 100+ whole-pool casts keep their price. Each band offers only its own tier — Early expires at `midLevel`, Mid at `lateLevel`.');
  lines.push('');
  lines.push('**Used by** — `kit` is a starting move, `pool` the level-up pool, `evo grant` handed over by an Evolution path, `evo pool` joined to the pool by a path, `signature` the tenth Mastery pip. A move used by nobody is in the Titanspawn / enemy slates only.');
  lines.push('');

  const catalog = Object.values(moves).filter((m) => !classMoves[m.id]);
  for (const type of TYPES) {
    const slate = catalog.filter((m) => m.type === type && !signatureMoves[m.id]).sort(bySlateOrder);
    const sigs = catalog.filter((m) => m.type === type && signatureMoves[m.id]).sort((a, b) => a.name.localeCompare(b.name));
    if (!slate.length && !sigs.length) continue;
    lines.push(`## ${type}`);
    lines.push('');
    lines.push(MOVE_HEADER);
    for (const m of slate) lines.push(moveRow(m));
    for (const m of sigs) lines.push(moveRow(m, 'Sig'));
    lines.push('');
  }

  lines.push('## Class moves');
  lines.push('');
  lines.push('Untiered, in no pool; each wears its holder’s innate primary type.');
  lines.push('');
  lines.push('| Move | Class | Cat | Kind | Pow | Mana | Pri | Target | Effect |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const c of Object.values(classes)) {
    if (!c.grantsMoveId) continue;
    const m = classMoves[c.grantsMoveId];
    const cat = m.category === 'physical' ? 'Phy' : 'Mag';
    lines.push(`| ${m.name} | ${c.name} | ${cat} | ${m.kind} | ${m.basePower ?? '—'} | ${m.manaCost} | ${signed(m.priority)} | ${TARGET_LABEL[m.target]} | ${cell(effect(m))} |`);
  }
  lines.push('');
  lines.push('Class passives:');
  lines.push('');
  for (const c of Object.values(classes)) {
    if (!c.grantsPassiveId) continue;
    const p = passives[c.grantsPassiveId];
    lines.push(`- **${c.name}** — ${p.name}: ${p.description}`);
  }
  lines.push('');
  return lines.join('\n');
}

// --- heroes.md ---------------------------------------------------------------------------

function moveTag(id: string, hero: HeroDefinition): string {
  const m = moves[id];
  if (!m) return `${id}?`;
  const offType = !hero.types.includes(m.type) ? ` (${m.type})` : '';
  return `${m.name}${offType}`;
}

function poolByBand(hero: HeroDefinition): string[] {
  const pool = (progressionTable.moveTiers[hero.id] ?? []).filter((id) => !hero.moveIds.includes(id));
  const band = (tier: string) =>
    pool
      .filter((id) => (moves[id]?.tier ?? 'early') === tier)
      .map((id) => moveTag(id, hero))
      .join(', ') || '—';
  return [`Early: ${band('early')}`, `Mid: ${band('mid')}`, `Late: ${band('late')}`];
}

function pathRow(p: EvolutionPath, hero: HeroDefinition): string {
  const graft = p.typeGraft ? (hero.types.length === 2 ? `${p.typeGraft} (trades ${hero.types[1]})` : p.typeGraft) : '—';
  const move = p.unlocksMoveIds.length ? p.unlocksMoveIds.map((id) => moveTag(id, hero)).join(', ') : '—';
  const passive = (p.grantsPassiveIds ?? [])
    .map((id) => {
      const d = passives[id];
      return d ? `**${d.name}** — ${d.description}` : id;
    })
    .join('; ') || '—';
  const learn = (p.learnableMoveIds ?? []).map((id) => moveTag(id, hero)).join(', ') || '—';
  return `| **${p.name}** | ${statGrants(p.statGrants)} | ${graft} | ${cell(move)} | ${cell(passive)} | ${cell(learn)} | ${cell(p.description ?? '')} |`;
}

function heroSection(hero: HeroDefinition): string[] {
  const lines: string[] = [];
  const s = hero.baseStats;
  const g = hero.growthGrades;
  const sched = scheduleFor(hero);
  lines.push(`### ${hero.name} — ${hero.types.join(' / ')} · ${hero.starter ? 'starter' : 'recruit-only'}`);
  lines.push('');
  lines.push(
    `- **Stats:** ${STAT_ORDER.filter((k) => k !== 'mpRegen')
      .map((k) => `${STAT_ABBR[k]} ${s[k]}`)
      .join(' · ')} (total ${heroStatTotal(s)}, MPR ${s.mpRegen})`
  );
  if (g)
    lines.push(
      `- **Grades:** ${STAT_ORDER.filter((k) => k !== 'mpRegen')
        .map((k) => `${STAT_ABBR[k]} ${g[k as keyof typeof g]}`)
        .join(' · ')}`
    );
  lines.push(`- **Schedule:** offers at ${sched.offerLevels.join(', ')} · Mid from ${sched.midLevel} · Late from ${sched.lateLevel}`);
  lines.push(`- **Kit:** ${hero.moveIds.map((id) => moveTag(id, hero)).join(', ')}`);
  const [early, mid, late] = poolByBand(hero);
  lines.push(`- **Pool** — ${early}`);
  lines.push(`  - ${mid}`);
  lines.push(`  - ${late}`);
  if (hero.signatureMoveId) {
    const m = moves[hero.signatureMoveId];
    lines.push(`- **Signature:** ${m.name} — ${m.category === 'physical' ? 'Phy' : 'Mag'} ${m.kind}, Pow ${m.basePower ?? '—'}, ${m.manaCost} mana, prio ${signed(m.priority)}, ${TARGET_LABEL[m.target]}; ${effect(m)}`);
  }
  lines.push('');
  lines.push('| Path | Stat grants | Graft | Grants move | Passive | Joins pool | Description |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const node of progressionTable.evolutions[hero.id] ?? []) for (const p of node.paths) lines.push(pathRow(p, hero));
  lines.push('');
  return lines;
}

function heroesDoc(): string {
  const lines: string[] = [];
  lines.push('# Heroes & Evolutions — balance pass');
  lines.push('');
  lines.push('Generated by `scripts/exportBalance.ts` from `src/data/heroes.ts` and `src/data/progression.ts`. Edit anything in place; the edits are read back by hand.');
  lines.push('');
  lines.push('**Reading a hero.** Stats sum to 550 (HP at 1:1, MP Regen outside it at 10); grades sum to 28 (S 7 … F 1) and set where a level’s 9.1 points land. The schedule is the levels that roll a move offer, from the band that level has opened. The pool is what those offers draw from, minus the kit; an off-type entry is marked with its type. The Evolution opens at 5 Mastery pips, the signature at 10.');
  lines.push('');
  lines.push('**Reading a path.** Stat grants land flat at the choice. A graft owns the secondary slot: a mono hero gains the type, a dual hero trades the one it was born with. A granted move is handed over on the spot (replace-or-decline at the cap); *Joins pool* moves are offered later through the schedule, tier-gated but never expiring for a grafted line. Every move here is in `moves.md`.');
  lines.push('');

  for (const type of TYPES) {
    const ofType = heroList.filter((h) => h.types[0] === type);
    if (!ofType.length) continue;
    lines.push(`## ${type}`);
    lines.push('');
    for (const h of ofType) lines.push(...heroSection(h));
  }
  return lines.join('\n');
}

// --- write -------------------------------------------------------------------------------

const outDir = join(__dirname, '..', '..', 'docs', 'balance');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'moves.md'), movesDoc() + '\n');
writeFileSync(join(outDir, 'heroes.md'), heroesDoc() + '\n');
console.log(`wrote ${join(outDir, 'moves.md')} and heroes.md`);
