import type { Metadata } from "next";
import "./globals.css";
import CommandPalette from "@/components/CommandPalette";

export const metadata: Metadata = {
  title: "Gravity - You think. It lands.",
  description: "Write. Walk away. Your thoughts find where they belong.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('gravity_theme');
                  if (theme === 'light') return;
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    return;
                  }
                  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 antialiased">
        {children}
        <CommandPalette />
      </body>
    </html>
  );
}
