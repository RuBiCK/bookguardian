import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
    title: 'Personal Library',
    description: 'Manage your personal book collection',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} font-sans antialiased bg-background text-foreground min-h-screen pb-24 md:pb-0 md:pt-16`}>
                <main className="container mx-auto px-4 py-6 max-w-5xl">
                    {children}
                </main>
                <Navigation />
            </body>
        </html>
    )
}
