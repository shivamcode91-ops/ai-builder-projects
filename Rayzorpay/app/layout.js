import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted at build time — no runtime request to a font CDN.
const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata = {
  title: "AgentGuard — a safety check between your AI assistant and your money",
  description:
    "AgentGuard reads every refund and payment link your AI assistant wants to send, compares it with the limits you set and the job you gave it, then approves it, holds it for you, or blocks it — and tells you why in plain words.",
  metadataBase: new URL("https://agentguard.vercel.app"),
  openGraph: {
    title: "AgentGuard",
    description:
      "Before your AI assistant moves any money, this checks it. Your limits and your instructions, both — and the stricter answer wins.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#0b0e12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
