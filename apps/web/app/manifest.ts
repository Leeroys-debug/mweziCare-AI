import type { MetadataRoute } from "next";
import { cookies } from "next/headers";

/**
 * Discretion (CLAUDE.md / E2 spec): if the user has turned on "discreet
 * mode" (Me page toggle), the installed app's name/icon never reveal what
 * the app is for — a neutral "Health Tracker" + generic icon instead of
 * "MweziCare AI" + the brand mark. manifest.ts is a dynamic route (not a
 * static file) specifically so it can read this per-device preference.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cookieStore = await cookies();
  const discreet = cookieStore.get("discreetMode")?.value === "1";

  return {
    name: discreet ? "Health Tracker" : "MweziCare AI",
    short_name: discreet ? "Health Tracker" : "MweziCare",
    description: discreet
      ? "A personal health tracker."
      : "Understand your cycle. Recognize the signs. Get care sooner.",
    start_url: "/en/track",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: discreet ? "#334155" : "#047857",
    icons: [
      {
        src: discreet ? "/icons/neutral.svg" : "/icons/brand.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
