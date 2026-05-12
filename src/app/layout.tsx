import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/ui/Nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sidenote",
  description: "Local-first research paper manager with AI-powered notes",
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon.png', type: 'image/png' }] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})()` }} />
      </head>
      <body className="h-full flex flex-col bg-gray-50 dark:bg-zinc-900">
        <Nav />
        {children}
      </body>
    </html>
  );
}
