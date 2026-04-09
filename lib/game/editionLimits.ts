import { isDemoEdition } from "./edition";

/** 体験版で到達できる最深階（この階にいる間はまだ探索可能。さらに下へは降りられない） */
export const DEMO_DEEPEST_FLOOR = 3;

/** 体験版で「階段を降りる」が使えるか（次の階へ進めるか） */
export function demoAllowsDescendFromFloor(floor: number): boolean {
  if (!isDemoEdition()) return true;
  return floor < DEMO_DEEPEST_FLOOR;
}

export const DEMO_DESCEND_BLOCKED_LINE =
  "【体験版】ここより下は有料版で進めます。（お試しは3階まで）";
