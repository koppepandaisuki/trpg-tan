import { describe, it, expect } from "vitest";
import {
  sheetFromVampireBlood,
  vampireBloodJsonUrl,
} from "../src/character/vampire-blood.js";

/** 実シート(5090745)のキー構造を模したサンプル。値は簡略化。 */
function sample(): Record<string, unknown> {
  return {
    game: "coc",
    pc_name: "朝臣 豊仁",
    shuzoku: "刑事",
    age: "28歳",
    sex: "男",
    pc_making_memo: "背景メモ",
    // STR, CON, POW, DEX, APP, SIZ, INT, EDU
    NA1: "15",
    NA2: "18",
    NA3: "18",
    NA4: "14",
    NA5: "7",
    NA6: "13",
    NA7: "14",
    NA8: "17",
    SAN_Left: "85",
    SAN_Max: "90",
    // 戦闘: 回避(初期28→60 成長), キック(初期25 のまま)
    TBAD: ["28", "25"],
    TBAP: ["60", "25"],
    // 探索: 目星は 12 行目(index 11)。初期25→80。
    TFAD: ["30", "10", "15", "10", "25", "10", "10", "1", "10", "40", "25", "25"],
    TFAP: ["30", "10", "15", "10", "70", "10", "10", "1", "10", "40", "25", "80"],
    // 交渉: 母国語(index 4) 初期85→90 + カスタム行(index 5)「交渉術」50
    TCAD: ["5", "15", "15", "5", "85", "0"],
    TCAP: ["5", "15", "15", "5", "90", "50"],
    TCAName: ["交渉術"],
    mylang_name: "日本語",
  };
}

describe("sheetFromVampireBlood", () => {
  const params = { id: "test-id", now: "2026-07-02T00:00:00Z" };

  it("maps profile and characteristics (NA1..NA8)", () => {
    const s = sheetFromVampireBlood(sample(), params);
    expect(s.systemId).toBe("coc6");
    expect(s.name).toBe("朝臣 豊仁");
    expect(s.occupationName).toBe("刑事");
    expect(s.characteristics).toMatchObject({
      STR: 15,
      CON: 18,
      POW: 18,
      DEX: 14,
      APP: 7,
      SIZ: 13,
      INT: 14,
      EDU: 17,
    });
    expect(s.notes).toContain("SAN 85/90");
    expect(s.backstory).toBe("背景メモ");
  });

  it("imports only grown skills, mapped to catalog keys", () => {
    const s = sheetFromVampireBlood(sample(), params);
    expect(s.skills.dodge).toBe(60); // 回避(成長済み)
    expect(s.skills.spot_hidden).toBe(80); // 目星
    // 聞き耳(TFA index 4: 25→70)
    expect(s.skills.listen).toBe(70);
    // 初期値のままの行は取り込まない
    expect(Object.values(s.skills)).not.toContain(25);
  });

  it("keeps custom rows as customSkills and records specialties", () => {
    const s = sheetFromVampireBlood(sample(), params);
    const custom = s.customSkills ?? [];
    expect(custom.some((c) => c.label === "交渉術" && c.value === 50)).toBe(true);
    // 母国語(専門: 日本語)
    expect(s.skillSpecialties?.own_language ?? s.skillSpecialties?.native_language)
      .toBeDefined();
  });

  it("rejects non-CoC sheets with a clear error", () => {
    expect(() =>
      sheetFromVampireBlood({ game: "sw2" }, params),
    ).toThrow(/対応していません/);
  });
});

describe("vampireBloodJsonUrl", () => {
  it("accepts bare ids and sheet URLs", () => {
    expect(vampireBloodJsonUrl("12345")).toBe(
      "https://charasheet.vampire-blood.net/12345.js",
    );
    expect(
      vampireBloodJsonUrl("https://charasheet.vampire-blood.net/5090745"),
    ).toBe("https://charasheet.vampire-blood.net/5090745.js");
    expect(
      vampireBloodJsonUrl("https://charasheet.vampire-blood.net/5090745.html"),
    ).toBe("https://charasheet.vampire-blood.net/5090745.js");
  });

  it("rejects other hosts", () => {
    expect(vampireBloodJsonUrl("https://evil.example.com/1.js")).toBeNull();
    expect(vampireBloodJsonUrl("hello")).toBeNull();
  });
});
