import type { Metadata } from "next";
import { Providers } from "@/providers";
import "./globals.css";
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
export const metadata: Metadata = { metadataBase: new URL(siteOrigin), title: { default: "ProvenanceX — Disaster media provenance", template: "%s · ProvenanceX" }, description: "Check registered file integrity, signer identity, and source declarations for disaster-response media before acting. Corroborate date, location, and context; a passport does not prove incident truth.", openGraph: { title: "ProvenanceX · Disaster media provenance", description: "Check source declarations and file integrity. Corroborate media before dispatch; a passport does not confirm incident truth.", images: ["/og-card.svg"] }, icons: { icon: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Providers>{children}</Providers></body></html> }


