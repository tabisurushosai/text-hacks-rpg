import {
  getPersistenceKeys,
  META_RECORDS_VERSION,
  SAVE_LEGACY_VERSION,
  SAVE_PAYLOAD_VERSION,
} from "./gameConfig";
import {
  emptyMetaRecords,
  type MetaRecords,
  mergeMetaAfterBossClear,
  mergeMetaAfterDeath,
  mergeMetaRunStarted,
} from "./metaRecords";
import type {
  Armor,
  CombatMenu,
  ExploreMenu,
  GameState,
  JobId,
  Player,
} from "./types";

type SaveEnvelope = {
  v: typeof SAVE_PAYLOAD_VERSION | typeof SAVE_LEGACY_VERSION;
  job: JobId;
  state: GameState;
};

export type LoadSaveResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: "missing" | "corrupt" };

function stripVolatileForSave(state: GameState): GameState {
  return {
    ...state,
    pendingClientEvent: null,
  };
}

export function serializeGameState(state: GameState): string {
  const env: SaveEnvelope = {
    v: SAVE_PAYLOAD_VERSION,
    job: state.job,
    state: stripVolatileForSave(state),
  };
  return JSON.stringify(env);
}

const JOBS: JobId[] = ["warrior", "mage", "farmer"];

function normalizeCombatMenu(raw: unknown): CombatMenu {
  if (raw === "main" || raw === "abilities" || raw === "item") return raw;
  return "main";
}

function normalizeExploreMenu(raw: unknown): ExploreMenu {
  if (
    raw === "main" ||
    raw === "items" ||
    raw === "magic" ||
    raw === "smith"
  ) {
    return raw;
  }
  return "main";
}

function normalizeLoadedState(s: GameState): GameState {
  const p = s.player as Player & { armor?: Armor | null };
  return {
    ...s,
    pendingClientEvent: null,
    bossCombatTurns: s.bossCombatTurns ?? 0,
    totalBattlesFought: s.totalBattlesFought ?? 0,
    exploreMenu: normalizeExploreMenu(s.exploreMenu),
    combatMenu: normalizeCombatMenu(s.combatMenu),
    stairsVisible: Boolean(s.stairsVisible),
    bossDefeated: Boolean(s.bossDefeated),
    player: {
      ...s.player,
      armor: p.armor ?? null,
    },
  };
}

export function parseGameState(json: string): GameState | null {
  const r = tryLoadGameFromJson(json);
  return r.ok ? r.state : null;
}

export function tryLoadGameFromJson(json: string): LoadSaveResult {
  try {
    const raw = JSON.parse(json) as Partial<SaveEnvelope>;
    const v = raw.v;
    if (v !== SAVE_PAYLOAD_VERSION && v !== SAVE_LEGACY_VERSION) {
      return { ok: false, reason: "corrupt" };
    }
    if (!raw.state || !raw.job || !JOBS.includes(raw.job)) {
      return { ok: false, reason: "corrupt" };
    }
    const s = raw.state;
    if (s.phase !== "explore" && s.phase !== "combat" && s.phase !== "cleared") {
      return { ok: false, reason: "corrupt" };
    }
    if (typeof s.floor !== "number" || !s.player || !Array.isArray(s.log)) {
      return { ok: false, reason: "corrupt" };
    }
    if (typeof s.player.hp !== "number" || typeof s.player.level !== "number") {
      return { ok: false, reason: "corrupt" };
    }
    return {
      ok: true,
      state: normalizeLoadedState({
        ...s,
        job: raw.job,
      } as GameState),
    };
  } catch {
    return { ok: false, reason: "corrupt" };
  }
}

export function saveGameToLocalStorage(state: GameState): void {
  if (typeof window === "undefined") return;
  try {
    const { save } = getPersistenceKeys();
    window.localStorage.setItem(save, serializeGameState(state));
  } catch {
    /* quota / private mode */
  }
}

export function loadGameFromLocalStorage(): GameState | null {
  const r = loadGameFromLocalStorageDetailed();
  return r.ok ? r.state : null;
}

export function loadGameFromLocalStorageDetailed(): LoadSaveResult {
  if (typeof window === "undefined") return { ok: false, reason: "missing" };
  try {
    const { save } = getPersistenceKeys();
    const raw = window.localStorage.getItem(save);
    if (!raw) return { ok: false, reason: "missing" };
    return tryLoadGameFromJson(raw);
  } catch {
    return { ok: false, reason: "corrupt" };
  }
}

export function clearSaveFromLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const { save } = getPersistenceKeys();
    window.localStorage.removeItem(save);
  } catch {
    /* ignore */
  }
}

export function hasSaveInLocalStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const { save } = getPersistenceKeys();
    return Boolean(window.localStorage.getItem(save));
  } catch {
    return false;
  }
}

export function loadMetaRecords(): MetaRecords {
  if (typeof window === "undefined") return emptyMetaRecords();
  try {
    const { meta } = getPersistenceKeys();
    const raw = window.localStorage.getItem(meta);
    if (!raw) return emptyMetaRecords();
    const o = JSON.parse(raw) as Partial<MetaRecords>;
    if (o.version !== META_RECORDS_VERSION) return emptyMetaRecords();
    return {
      version: META_RECORDS_VERSION,
      deepestFloorReached: Math.max(1, Number(o.deepestFloorReached) || 1),
      bossClears: Math.max(0, Number(o.bossClears) || 0),
      runsStarted: Math.max(0, Number(o.runsStarted) || 0),
      lastUpdatedAt:
        typeof o.lastUpdatedAt === "string"
          ? o.lastUpdatedAt
          : new Date().toISOString(),
    };
  } catch {
    return emptyMetaRecords();
  }
}

export function saveMetaRecords(r: MetaRecords): void {
  if (typeof window === "undefined") return;
  try {
    const { meta } = getPersistenceKeys();
    window.localStorage.setItem(meta, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

export function persistMetaAfterDeath(
  diedAtFloor: number,
): MetaRecords {
  const next = mergeMetaAfterDeath(loadMetaRecords(), diedAtFloor);
  saveMetaRecords(next);
  return next;
}

export function persistMetaAfterBossClear(floorWhenCleared: number): MetaRecords {
  const next = mergeMetaAfterBossClear(loadMetaRecords(), floorWhenCleared);
  saveMetaRecords(next);
  return next;
}

export function persistMetaRunStarted(): MetaRecords {
  const next = mergeMetaRunStarted(loadMetaRecords());
  saveMetaRecords(next);
  return next;
}

export function clearMetaFromLocalStorage(): void {
  saveMetaRecords(emptyMetaRecords());
}
