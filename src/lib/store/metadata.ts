// =============================================================
// PART 4 — App Store Metadata Engine
// -------------------------------------------------------------
// Composes descriptions.ts (copy) + screenshots.ts (image requirements)
// + release/metadata-config.ts (support/website URLs, already the
// single source of truth for those) into the two platform-specific
// listing payloads Prompt 27 asks for.
// =============================================================
import {
  GOOGLE_PLAY_TITLE,
  GOOGLE_PLAY_SHORT_DESCRIPTION,
  GOOGLE_PLAY_FULL_DESCRIPTION,
  APPLE_SUBTITLE,
  APPLE_PROMOTIONAL_TEXT,
  STORE_CATEGORY_GOOGLE_PLAY,
  STORE_CATEGORY_APPLE,
  STORE_KEYWORDS,
  validateStoreCopyLengths,
} from "./descriptions";
import { generateScreenshotsReport } from "./screenshots";
import { SUPPORT_URL, WEBSITE_URL } from "@/lib/release/metadata-config";

export interface GooglePlayListing {
  title: string;
  shortDescription: string;
  fullDescription: string;
  keywords: string[];
  category: string;
  screenshotsReady: boolean;
}

export interface AppleAppStoreListing {
  title: string;
  subtitle: string;
  promotionalText: string;
  keywords: string[];
  category: string;
  supportUrl: string;
  marketingUrl: string;
  screenshotsReady: boolean;
}

export interface StoreMetadataReport {
  googlePlay: GooglePlayListing;
  appleAppStore: AppleAppStoreListing;
  copyLengthChecks: ReturnType<typeof validateStoreCopyLengths>;
  allCopyWithinLimits: boolean;
  generatedAt: string;
}

export function generateStoreMetadata(): StoreMetadataReport {
  const screenshots = generateScreenshotsReport();
  const copyLengthChecks = validateStoreCopyLengths();

  const googlePlay: GooglePlayListing = {
    title: GOOGLE_PLAY_TITLE,
    shortDescription: GOOGLE_PLAY_SHORT_DESCRIPTION,
    fullDescription: GOOGLE_PLAY_FULL_DESCRIPTION,
    keywords: STORE_KEYWORDS,
    category: STORE_CATEGORY_GOOGLE_PLAY,
    screenshotsReady: screenshots.android.haveAny,
  };

  const appleAppStore: AppleAppStoreListing = {
    title: GOOGLE_PLAY_TITLE,
    subtitle: APPLE_SUBTITLE,
    promotionalText: APPLE_PROMOTIONAL_TEXT,
    keywords: STORE_KEYWORDS,
    category: STORE_CATEGORY_APPLE,
    supportUrl: SUPPORT_URL,
    marketingUrl: WEBSITE_URL,
    screenshotsReady: screenshots.ios.haveAny,
  };

  return {
    googlePlay,
    appleAppStore,
    copyLengthChecks,
    allCopyWithinLimits: copyLengthChecks.every((c) => c.withinLimit),
    generatedAt: new Date().toISOString(),
  };
}
