import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "When to Post — global posting-time heatmap",
  description:
    "Spin the globe, pick a country, and see the best local time to post on Facebook, Instagram, TikTok, X, LinkedIn or YouTube — scored 1–10 against each country's daily rhythm.",
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
