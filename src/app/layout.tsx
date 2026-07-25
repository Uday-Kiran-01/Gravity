import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gravity: Everything Falls Into Place",
  description:
    "An AI-first thinking environment. Write. Walk away. Everything else happens automatically.",
  icons: {
    icon: "/favicon.ico",
  },
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
      </body>
    </html>
  );
}
