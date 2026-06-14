import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata = {
  title: "SocialConnect Premium",
  description: "A stunning social media scheduler.",
};

import { Providers } from "./providers";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={outfit.variable}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
