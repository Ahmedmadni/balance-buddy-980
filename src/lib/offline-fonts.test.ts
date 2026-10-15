import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("self-hosted Arabic typography", () => {
  const css = readFileSync(resolve("src/styles.css"), "utf8");
  const root = readFileSync(resolve("src/routes/__root.tsx"), "utf8");
  const sw = readFileSync(resolve("public/sw.js"), "utf8");
  const fonts = [
    "IBM-Plex-Sans-Arabic-Light.ttf", "IBM-Plex-Sans-Arabic-Regular.ttf",
    "IBM-Plex-Sans-Arabic-Medium.ttf", "IBM-Plex-Sans-Arabic-SemiBold.ttf",
    "IBM-Plex-Sans-Arabic-Bold.ttf", "Cairo-Variable.ttf",
  ];
  test("fonts ship locally and are precached", () => {
    for (const font of fonts) {
      expect(existsSync(resolve("public/fonts", font))).toBe(true);
      expect(css).toContain(`/fonts/${font}`);
      expect(sw).toContain(`/fonts/${font}`);
    }
  });
  test("Google Fonts network fetches are absent", () => {
    expect(root).not.toContain("fonts.googleapis.com");
    expect(root).not.toContain("fonts.gstatic.com");
    expect(css).not.toContain("fonts.googleapis.com");
    expect(css).toContain("font-display: swap");
  });
  test("license texts are retained", () => {
    for (const f of ["OFL-IBM-Plex-Sans-Arabic.txt", "OFL-Cairo.txt"]) {
      expect(existsSync(resolve("public/fonts", f))).toBe(true);
    }
  });
});
