import "./globals.css";
import { Inter, Bebas_Neue } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-heading",
});

export const metadata = {
  title: "Ministry of Comedy",
  description: "A Comedy Club in Koramangala",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${bebas.variable} bg-black text-white`}
      >
        {children}
      </body>
    </html>
  );
}
