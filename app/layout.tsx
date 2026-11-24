import type { Metadata } from "next";
import { Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { fontVariables } from "@/lib/fonts";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationLoader } from "@/components/dashboard/navigation-loader";
import "./globals.css";

export const metadata: Metadata = {
  title: "1С Аналитика",
  description: "Аналитика продаж розничной сети, поверх 1С OData",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${fontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground font-igra-sans"
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <Suspense fallback={null}>
            <NavigationLoader />
          </Suspense>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
