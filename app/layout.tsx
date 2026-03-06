import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const APP_URL = "https://investbuddyai.com"
const APP_NAME = "InvestBuddy AI"
const DESCRIPTION =
  "Your Portfolio\u2019s Intelligence Layer. AI-powered equity portfolio management for Indian markets. Get quant-driven buy/sell signals, live P&L tracking, sector analytics, and AI recommendations \u2014 all in one platform. Supports Upstox, Zerodha and more."

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080c18",
}

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: `${APP_NAME} — AI-Powered Equity Management (Beta)`,
    template: `%s | ${APP_NAME}`,
  },

  description: DESCRIPTION,

  keywords: [
    "AI stock portfolio management India",
    "quant analysis NSE BSE stocks",
    "AI buy sell signals Indian equities",
    "portfolio tracker India",
    "Upstox portfolio management",
    "Zerodha AI portfolio",
    "stock recommendation AI",
    "Indian equity management platform",
    "RSI MACD stock signals India",
    "composite quant score stocks",
    "investment portfolio AI India",
    "InvestBuddy AI",
    "equity management software India",
    "AI trading assistant India",
    "portfolio analytics NSE",
  ],

  authors: [{ name: "InvestBuddy AI", url: APP_URL }],
  creator: "InvestBuddy AI",
  publisher: "InvestBuddy AI",

  category: "Finance",

  openGraph: {
    type: "website",
    locale: "en_IN",
    url: APP_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} — AI-Powered Equity Management for Indian Markets`,
    description: DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Your Portfolio\u2019s Intelligence Layer`,
        type: "image/png",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    site: "@investbuddyai",
    creator: "@investbuddyai",
    title: `${APP_NAME} — AI Equity Management for India`,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: APP_URL,
  },

  manifest: "/manifest.json",

  icons: {
    icon: [
      { url: "/Logos/investbuddy_favicon_transparent.svg", type: "image/svg+xml" },
      { url: "/icon", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },

  other: {
    "mobile-web-app-capable": "yes",
    "application-name": APP_NAME,
    "msapplication-TileColor": "#080c18",
    "msapplication-config": "/browserconfig.xml",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        {/* CSS-only splash — visible immediately on first paint, dismisses via animation */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <style>{`
          #app-splash {
            position: fixed; inset: 0; z-index: 9999;
            background: #080c18;
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
            animation: _splash-out 0.5s ease-out 1.8s forwards;
            pointer-events: none;
          }
          #app-splash-mascot {
            width: 80px; height: 80px;
            animation: _splash-bounce 1.8s ease-in-out infinite;
          }
          #app-splash-wordmark { width: 160px; opacity: 0.9; }
          #app-splash-dots { display: flex; gap: 6px; }
          #app-splash-dots span {
            display: block; width: 6px; height: 6px; border-radius: 50%;
            background: #6c63ff;
            animation: _splash-dot 1.2s ease-in-out infinite;
          }
          #app-splash-dots span:nth-child(2) { animation-delay: 0.2s; }
          #app-splash-dots span:nth-child(3) { animation-delay: 0.4s; }
          @keyframes _splash-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
          @keyframes _splash-dot { 0%,100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.25); } }
          @keyframes _splash-out { to { opacity: 0; visibility: hidden; } }
        `}</style>
        <div id="app-splash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img id="app-splash-mascot" src="/Logos/investbuddy_mascot_logo.svg" alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img id="app-splash-wordmark" src="/Logos/investbuddy_wordmark.svg" alt="InvestBuddy AI" />
          <div id="app-splash-dots"><span /><span /><span /></div>
        </div>
        {children}
      </body>
    </html>
  )
}
