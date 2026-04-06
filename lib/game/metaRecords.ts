export interface MetaRecords {
  version: number;
  /** 記録上の最深到達階（死亡・クリア時に更新） */
  deepestFloorReached: number;
  /** 層底の主を倒した累計回数 */
  bossClears: number;
  /** タイトルから職を選んで開始した累計回数 */
  runsStarted: number;
  lastUpdatedAt: string;
}

export function emptyMetaRecords(): MetaRecords {
  return {
    version: 1,
    deepestFloorReached: 1,
    bossClears: 0,
    runsStarted: 0,
    lastUpdatedAt: new Date(0).toISOString(),
  };
}

export function mergeMetaAfterDeath(
  prev: MetaRecords,
  diedAtFloor: number,
): MetaRecords {
  return {
    ...prev,
    deepestFloorReached: Math.max(prev.deepestFloorReached, diedAtFloor),
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function mergeMetaAfterBossClear(
  prev: MetaRecords,
  floorWhenCleared: number,
): MetaRecords {
  return {
    ...prev,
    deepestFloorReached: Math.max(prev.deepestFloorReached, floorWhenCleared),
    bossClears: prev.bossClears + 1,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function mergeMetaRunStarted(prev: MetaRecords): MetaRecords {
  return {
    ...prev,
    runsStarted: prev.runsStarted + 1,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/** 表示用の短い一行 */
export function formatMetaSummary(r: MetaRecords): string {
  return `記録：最深 ${r.deepestFloorReached} 階・層底踏破 ${r.bossClears} 回・冒険開始 ${r.runsStarted} 回`;
}
