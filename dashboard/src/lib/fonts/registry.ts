import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { GeistPixelSquare } from "geist/font/pixel";

/**
 * Font registry — LOCAL fonts only (the `geist` package bundles its files).
 * The template's next/font/google families were removed so `npm run build`
 * works fully offline: Google-font fetching at build time would fail on a
 * network-isolated checkout, and a data dashboard needs exactly two faces.
 */
const geist = GeistSans; // pre-configured: variable --font-geist-sans
const geistMono = GeistMono; // pre-configured: variable --font-geist-mono
const geistPixelSquare = GeistPixelSquare; // pre-configured: variable --font-geist-pixel

const fontRegistry = {
  geist: {
    label: "Geist",
    font: geist,
  },
  geistMono: {
    label: "Geist Mono",
    font: geistMono,
  },
  geistPixelSquare: {
    label: "Geist Pixel Square",
    font: geistPixelSquare,
  },
} as const;

export type FontKey = keyof typeof fontRegistry;

export const fontKeys = Object.keys(fontRegistry) as FontKey[];

export const fontVars = Object.values(fontRegistry)
  .map(({ font }) => font.variable)
  .join(" ");

export const fontOptions = fontKeys.map((key) => ({
  key,
  label: fontRegistry[key].label,
}));
