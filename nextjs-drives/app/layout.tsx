import type { ReactNode } from "react";
import "./globals.css";
import { PwaRegister } from "@/app/pwa-register";

export const metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TeslaMate Drives",
  },
  title: "TeslaMate Drives",
  description: "Drive listing and metadata updates for TeslaMate",
  icons: {
    apple: "/icons/icon-192.svg",
    icon: [
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#235789",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fff", color: "#111" }}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
