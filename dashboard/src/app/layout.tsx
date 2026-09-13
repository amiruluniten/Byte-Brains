import type { ReactNode } from "react";

export const metadata = {
  title: "The Missing Billions — Byte-Brains",
  description:
    "Malaysia's tourism recovery is extensive, not intensive. DOSM Datathon 2026 entry.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          background: "#0f1117",
          color: "#e6e6e6",
        }}
      >
        {children}
      </body>
    </html>
  );
}
