import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import BackgroundEffects from "@/components/BackgroundEffects";

const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "BrandForge AI — Personal Branding Studio",
  description: "LinkedIn Personal Branding Assistant — AI-powered resume analysis and brand voice generation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            <BackgroundEffects />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
