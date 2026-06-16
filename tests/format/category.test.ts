import { describe, it, expect } from "vitest";
import {
  categoryLabel,
  fileFormatLabel,
  parseCategoryParam,
  STORE_CATEGORIES,
} from "@/lib/format/category";

describe("categoryLabel", () => {
  it("returns Japanese labels for all known product types", () => {
    expect(categoryLabel("full_package")).toBe("フルパッケージ");
    expect(categoryLabel("scenario")).toBe("シナリオ");
    expect(categoryLabel("rulebook")).toBe("ルールブック");
    expect(categoryLabel("character_art")).toBe("キャラクターイラスト");
    expect(categoryLabel("map")).toBe("マップ");
    expect(categoryLabel("bgm_audio")).toBe("BGM・音声");
  });
});

describe("fileFormatLabel", () => {
  it("returns Japanese labels for all known formats", () => {
    expect(fileFormatLabel("pdf")).toBe("PDF");
    expect(fileFormatLabel("image_zip")).toBe("画像ZIP");
    expect(fileFormatLabel("audio")).toBe("音声(MP3/WAV)");
    expect(fileFormatLabel("pack")).toBe("フルパッケージ(.paradice)");
  });
});

describe("parseCategoryParam", () => {
  it("returns null for undefined / empty / unknown values", () => {
    expect(parseCategoryParam(undefined)).toBeNull();
    expect(parseCategoryParam("")).toBeNull();
    expect(parseCategoryParam("unknown")).toBeNull();
    expect(parseCategoryParam("javascript:alert(1)")).toBeNull();
  });

  it("passes through valid product types", () => {
    expect(parseCategoryParam("full_package")).toBe("full_package");
    expect(parseCategoryParam("scenario")).toBe("scenario");
    expect(parseCategoryParam("bgm_audio")).toBe("bgm_audio");
  });
});

describe("STORE_CATEGORIES", () => {
  it("starts with an 'all' option (null)", () => {
    expect(STORE_CATEGORIES[0]).toEqual({ value: null, label: "すべて" });
  });

  it("contains 6 product types plus 'all'", () => {
    expect(STORE_CATEGORIES.length).toBe(7);
  });

  it("features フルパッケージ right after 'all'", () => {
    expect(STORE_CATEGORIES[1]).toEqual({
      value: "full_package",
      label: "フルパッケージ",
    });
  });
});
