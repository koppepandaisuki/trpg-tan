import { describe, it, expect } from "vitest";
import {
  COVER_MAX_BYTES,
  PRODUCT_FILE_MAX_BYTES,
  mimeToCoverExt,
  mimeToProductFileExt,
} from "@/lib/format/upload";

describe("size constants", () => {
  it("COVER_MAX_BYTES is exactly 10 MB", () => {
    expect(COVER_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(COVER_MAX_BYTES).toBe(10_485_760);
  });

  it("PRODUCT_FILE_MAX_BYTES is the provisional 50 MB cap (Free plan)", () => {
    expect(PRODUCT_FILE_MAX_BYTES).toBe(50 * 1024 * 1024);
    expect(PRODUCT_FILE_MAX_BYTES).toBe(52_428_800);
  });
});

describe("mimeToCoverExt", () => {
  it("maps the three canonical cover MIME types", () => {
    expect(mimeToCoverExt("image/png")).toBe("png");
    expect(mimeToCoverExt("image/jpeg")).toBe("jpg");
    expect(mimeToCoverExt("image/webp")).toBe("webp");
  });

  it("is case-insensitive on the MIME string", () => {
    expect(mimeToCoverExt("IMAGE/PNG")).toBe("png");
    expect(mimeToCoverExt("Image/Jpeg")).toBe("jpg");
    expect(mimeToCoverExt("image/WEBP")).toBe("webp");
  });

  it("returns null for unknown image MIME types", () => {
    expect(mimeToCoverExt("image/gif")).toBeNull();
    expect(mimeToCoverExt("image/bmp")).toBeNull();
    expect(mimeToCoverExt("image/avif")).toBeNull();
    expect(mimeToCoverExt("image/svg+xml")).toBeNull();
  });

  it("returns null for non-image MIME types", () => {
    expect(mimeToCoverExt("application/pdf")).toBeNull();
    expect(mimeToCoverExt("text/html")).toBeNull();
    expect(mimeToCoverExt("application/octet-stream")).toBeNull();
  });

  it("returns null for empty / blank input", () => {
    expect(mimeToCoverExt("")).toBeNull();
  });

  it("does not trim — surrounding whitespace yields null", () => {
    // Browsers do not send whitespace-padded Content-Type; treat as bad input
    expect(mimeToCoverExt(" image/png ")).toBeNull();
  });
});

describe("mimeToProductFileExt", () => {
  describe("file_format = 'pdf'", () => {
    it("accepts application/pdf only", () => {
      expect(mimeToProductFileExt("application/pdf", "pdf")).toBe("pdf");
    });

    it("rejects everything else, including zip and audio", () => {
      expect(mimeToProductFileExt("application/zip", "pdf")).toBeNull();
      expect(mimeToProductFileExt("audio/mpeg", "pdf")).toBeNull();
      expect(mimeToProductFileExt("image/png", "pdf")).toBeNull();
      expect(mimeToProductFileExt("text/plain", "pdf")).toBeNull();
    });
  });

  describe("file_format = 'image_zip'", () => {
    it("accepts application/zip only", () => {
      expect(mimeToProductFileExt("application/zip", "image_zip")).toBe("zip");
    });

    it("rejects everything else, including pdf and other zip variants", () => {
      expect(mimeToProductFileExt("application/pdf", "image_zip")).toBeNull();
      expect(mimeToProductFileExt("audio/mpeg", "image_zip")).toBeNull();
      // application/x-zip-compressed (legacy IE/Edge variant) is intentionally
      // NOT in the canonical allow-list — README and Supabase bucket settings
      // only list application/zip. Add when ACCEPTANCE surfaces real demand.
      expect(
        mimeToProductFileExt("application/x-zip-compressed", "image_zip"),
      ).toBeNull();
    });
  });

  describe("file_format = 'audio'", () => {
    it("accepts mpeg → .mp3 and wav → .wav", () => {
      expect(mimeToProductFileExt("audio/mpeg", "audio")).toBe("mp3");
      expect(mimeToProductFileExt("audio/wav", "audio")).toBe("wav");
    });

    it("rejects unsupported audio types", () => {
      expect(mimeToProductFileExt("audio/flac", "audio")).toBeNull();
      expect(mimeToProductFileExt("audio/ogg", "audio")).toBeNull();
      expect(mimeToProductFileExt("audio/aac", "audio")).toBeNull();
      // Legacy audio/x-wav variant deliberately rejected for the same
      // reason as application/x-zip-compressed above.
      expect(mimeToProductFileExt("audio/x-wav", "audio")).toBeNull();
    });

    it("rejects non-audio types", () => {
      expect(mimeToProductFileExt("application/pdf", "audio")).toBeNull();
      expect(mimeToProductFileExt("application/zip", "audio")).toBeNull();
    });
  });

  it("is case-insensitive on the MIME string", () => {
    expect(mimeToProductFileExt("APPLICATION/PDF", "pdf")).toBe("pdf");
    expect(mimeToProductFileExt("Audio/MPEG", "audio")).toBe("mp3");
    expect(mimeToProductFileExt("Application/Zip", "image_zip")).toBe("zip");
  });

  it("returns null for empty MIME", () => {
    expect(mimeToProductFileExt("", "pdf")).toBeNull();
    expect(mimeToProductFileExt("", "image_zip")).toBeNull();
    expect(mimeToProductFileExt("", "audio")).toBeNull();
  });

  it("returns null for unknown file_format (defensive against bad input)", () => {
    // The static type FileFormat would normally block this at compile time,
    // but runtime data from DB / form could drift if a future migration
    // adds a value the code does not yet know.
    expect(
      // @ts-expect-error testing runtime safety against unknown enum value
      mimeToProductFileExt("application/pdf", "video"),
    ).toBeNull();
    expect(
      // @ts-expect-error
      mimeToProductFileExt("application/pdf", ""),
    ).toBeNull();
  });
});
