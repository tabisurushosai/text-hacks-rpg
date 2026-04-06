import {
  META_RECORDS_VERSION,
  PERSISTENCE_KEYS,
  SAVE_PAYLOAD_VERSION,
} from "./gameConfig";
import {
  emptyMetaRecords,
  type MetaRecords,
  mergeMetaAfterBossClear,
  mergeMetaAfterDeath,
  mergeMetaRunStarted,
} from "./metaRecords";
import type { GameState, JobId } from "./types";

type SaveEnvelope = {
  v: typeof SAVE_PAYLOAD_VERSION;
  job: JobId;
  state: GameState;
};

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

export function parseGameState(json: string): GameState | null {
  try {
    const raw = JSON.parse(json) as Partial<SaveEnvelope>;
    if (raw.v !== SAVE_PAYLOAD_VERSION || !raw.state || !raw.job) return null;
    const s = raw.state;
    if (s.phase !== "explore" && s.phase !== "combat" && s.phase !== "cleared") {
      return null;
    }
    if (typeof s.floor !== "number" || !s.player || !Array.isArray(s.log)) {
      return null;
    }
    return {
      ...s,
      pendingClientEvent: null,
    } as GameState;
  } catch {
    return null;
  }
}

export function saveGameToLocalStorage(state: GameState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PERSISTENCE_KEYS.save,
      serializeGameState(state),
    );
  } catch {
    /* quota / private mode */
  }
}

export function loadGameFromLocalStorage(): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PERSISTENCE_KEYS.save);
    if (!raw) return null;
    return parseGameState(raw);
  } catch {
    return null;
  }
}

export function clearSaveFromLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PERSISTENCE_KEYS.save);
  } catch {
    /* ignore */
  }
}

export function hasSaveInLocalStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(PERSISTENCE_KEYS.save));
  } catch {
    return false;
  }
}

export function loadMetaRecords(): MetaRecords {
  if (typeof window === "undefined") return emptyMetaRecords();
  try {
    const raw = window.localStorage.getItem(PERSISTENCE_KEYS.meta);
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
    window.localStorage.setItem(PERSISTENCE_KEYS.meta, JSON.stringify(r));
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
