import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";

export const metadata: Metadata = {
  title: "KAI-OS // Krishna AI Links Pvt. Ltd.",
  description: "Enterprise Management Console",
  manifest: "/manifest.json",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "KAI-OS // Krishna AI Links Pvt. Ltd.",
    description: "Enterprise Management Console",
    images: ["/logo-vertical.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KAI-OS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
