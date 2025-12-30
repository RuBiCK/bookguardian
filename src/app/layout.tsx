import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import { SessionProvider } from '@/components/SessionProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
    title: {
        default: 'Book Guardian - Your Personal Library',
        template: '%s | Book Guardian'
    },
    description: 'Organize, track, and cherish your book collection with a beautiful, privacy-focused library management system.',
    keywords: ['book library', 'book management', 'personal library', 'book collection', 'book tracker', 'reading list'],
    authors: [{ name: 'Book Guardian' }],
    icons: {
        icon: '/logo.svg',
        apple: '/apple-icon.png',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} font-sans antialiased bg-background text-foreground min-h-screen pb-24 md:pb-0 md:pt-16`}>
                <SessionProvider>
                    <main className="container mx-auto px-4 py-6 max-w-5xl">
                        {children}
                    </main>
                    <Navigation />
                </SessionProvider>
            </body>
        </html>
    )
}
