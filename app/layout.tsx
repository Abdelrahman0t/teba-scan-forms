import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

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
      <body className="min-h-full bg-slate-50 text-slate-900 font-sans">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
