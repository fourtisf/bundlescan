import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BundleScan — Launch Forensics for Solana",
  description:
    "BundleScan replays block zero and exposes the wallets that rigged the launch before you bought.",
  metadataBase: new URL(process.env.PUBLIC_BASE_URL || "https://bundlescan.io"),
  openGraph: {
    title: "BundleScan — Launch Forensics for Solana",
    description:
      "Replays the first blocks of any token and exposes the wallets that captured supply alongside the deployer.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BundleScan — Launch Forensics for Solana",
    description:
      "Replays block zero and exposes the wallets that rigged the launch before you bought.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600&f[]=switzer@400,500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="ambient" />
        {children}
      </body>
    </html>
  );
}
