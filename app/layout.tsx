import type React from "react"
import type { Metadata } from "next"

import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

import { Plus_Jakarta_Sans as Font_Plus_Jakarta_Sans, IBM_Plex_Mono as Font_IBM_Plex_Mono, Lora as Font_Lora } from 'next/font/google'

// Initialize fonts
const _plusJakartaSans = Font_Plus_Jakarta_Sans({ subsets: ['latin'], weight: ["200","300","400","500","600","700","800"] })
const _ibmPlexMono = Font_IBM_Plex_Mono({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700"] })
const _lora = Font_Lora({ subsets: ['latin'], weight: ["400","500","600","700"] })

export const metadata: Metadata = {
  title: "VSCode Extension Builder",
  description: "Build VS Code extensions with templates and AI",
    generator: 'Next.js'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
