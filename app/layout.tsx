import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "مركز طيبة سكان للأشعة - نظام إدخال البيانات الطبية",
  description: "نظام إدخال وتوثيق التعرض لجرعات الأشعة والتثقيف الصحي للمريض والأسرة",
  icons: {
    icon: "/tiba-scan.jpg",
    shortcut: "/tiba-scan.jpg",
    apple: "/tiba-scan.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <footer className="bg-[#24082c] text-purple-300/80 py-4 text-center text-xs no-print border-t border-purple-900/50">
          مركز طيبة سكان للأشعة • Tiba Scan Investigation & Radiology Center © 2026
        </footer>
      </body>
    </html>
  );
}
