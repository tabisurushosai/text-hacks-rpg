"use client";

import type { EnemyInstance, Player, SpellElement } from "@/lib/game/types";

const WEAK_LABEL: Record<SpellElement, string> = {
  fire: "炎",
  ice: "氷",
  thunder: "雷",
};

function barClass(ratio: number): string {
  if (ratio <= 0.25) return "bg-[#8b4040]";
  if (ratio <= 0.5) return "bg-[#a67c52]";
  return "bg-[var(--accent)]";
}

export function CombatHud({
  enemy,
  player,
}: {
  enemy: EnemyInstance;
  player: Player;
}) {
  const eh = enemy.hp / Math.max(1, enemy.maxHp);
  const ph = player.hp / Math.max(1, player.maxHp);
  const pm = player.mp / Math.max(1, player.maxMp);
  const frozen = enemy.frozenTurns ?? 0;

  return (
    <div
      className="combat-hud-surface mb-2 shrink-0 space-y-2 rounded border border-[var(--border)] bg-[#121a22]/90 px-2.5 py-2 text-xs"
      aria-label="戦闘状況"
    >
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-1 text-[var(--text)]">
          <span className="font-medium">{enemy.name}</span>
          <span className="tabular-nums text-[var(--muted)]">
            HP {enemy.hp}/{enemy.maxHp}
            {enemy.weakness ? (
              <span className="ml-1.5 text-[var(--accent)]">
                弱点 {WEAK_LABEL[enemy.weakness]}
              </span>
            ) : null}
          </span>
        </div>
        <div
          className="mt-1 h-2 w-full overflow-hidden rounded bg-[#1a2630]"
          role="progressbar"
          aria-valuenow={enemy.hp}
          aria-valuemin={0}
          aria-valuemax={enemy.maxHp}
        >
          <div
            className={`h-full transition-[width] duration-150 motion-reduce:transition-none ${barClass(eh)}`}
            style={{ width: `${Math.round(eh * 100)}%` }}
          />
        </div>
        {frozen > 0 ? (
          <p className="mt-1 text-[var(--muted)]">拘束 {frozen} ターン</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-2">
        <div>
          <div className="flex justify-between text-[var(--muted)]">
            <span>自分 HP</span>
            <span className="tabular-nums text-[var(--text)]">
              {player.hp}/{player.maxHp}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-[#1a2630]">
            <div
              className={`h-full ${barClass(ph)}`}
              style={{ width: `${Math.round(ph * 100)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[var(--muted)]">
            <span>MP</span>
            <span className="tabular-nums text-[var(--text)]">
              {player.mp}/{player.maxMp}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-[#1a2630]">
            <div
              className="h-full bg-[#5a7ab0]"
              style={{ width: `${Math.round(pm * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
