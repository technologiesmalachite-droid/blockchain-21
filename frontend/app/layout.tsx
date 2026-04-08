import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MarketTicker } from "@/components/MarketTicker";
import { ToastViewport } from "@/components/ui/ToastViewport";
import { BRAND_DESCRIPTION, BRAND_LOGO_PATH, BRAND_NAME } from "@/lib/brand";
import { DemoProvider } from "@/lib/demo-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${BRAND_NAME} | Crypto Exchange`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  icons: {
    icon: BRAND_LOGO_PATH,
    apple: BRAND_LOGO_PATH,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <DemoProvider>
          <Header />
          <MarketTicker />
          <ToastViewport />
          <main>{children}</main>
          <Footer />
        </DemoProvider>
      </body>
    </html>
  );
}
