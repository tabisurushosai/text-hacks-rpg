import { describe, expect, it } from "vitest";
import { logLinePrefix, logLineTone } from "./logLineTone";

describe("logLineTone", () => {
  it("classifies common patterns", () => {
    expect(logLineTone("弱点を突いた。")).toBe("emphasis");
    expect(logLineTone("スライムの攻撃。3のダメージ。")).toBe("damage");
    expect(logLineTone("HPが12回復した。")).toBe("heal");
    expect(logLineTone("薬草を拾った。")).toBe("loot");
    expect(logLineTone("戦闘後: HP 20/28、MP 5/14。")).toBe("muted");
    expect(logLineTone("探索した。")).toBe("default");
  });

  it("prefix is non-empty for non-default tones", () => {
    expect(logLinePrefix("damage").length).toBeGreaterThan(0);
    expect(logLinePrefix("default")).toBe("");
  });
});
