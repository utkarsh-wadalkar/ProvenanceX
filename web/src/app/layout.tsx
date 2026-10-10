import type { Metadata } from "next";
import { Providers } from "@/providers";
import "./globals.css";
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
export const metadata: Metadata = { metadataBase: new URL(siteOrigin), title: { default: "ProvenanceX — Media provenance", template: "%s · ProvenanceX" }, description: "Check photos, videos, and files from social posts. Inspect registered file integrity, signed source declarations, and edit history before sharing.", openGraph: { title: "ProvenanceX · Media provenance", description: "Keep the source with every share. Verify registered file identity and inspect signed declarations for photos, videos, and other files.", images: ["/og-card.svg"] }, icons: { icon: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Providers>{children}</Providers></body></html> }


