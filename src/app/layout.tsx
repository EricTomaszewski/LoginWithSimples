import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Login With Simples",
  description: "Firebase authentication demo with persistent profile fields",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
