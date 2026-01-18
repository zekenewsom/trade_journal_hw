import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { TRPCProvider } from "@/trpc/react";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "HighWater",
  description: "Institutional-grade trade analytics platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground min-h-screen`}>
        <Auth0Provider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <TRPCProvider>
              {children}
              <Toaster />
            </TRPCProvider>
          </ThemeProvider>
        </Auth0Provider>
      </body>
    </html>
  );
}
