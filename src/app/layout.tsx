import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import { SessionProvider } from '@/components/SessionProvider'
import ImpersonationBanner from '@/components/ImpersonationBanner'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
    metadataBase: new URL('https://bookguardian.marcote.net'),
    title: {
        default: 'Book Guardian - Free Personal Library Management System',
        template: '%s | Book Guardian'
    },
    description: 'Free, open-source personal library management system. Organize your book collection with AI-powered scanning, track lending, export to CSV/JSON/MARC21. 100% free sign-up with Google.',
    keywords: [
        'book library',
        'book management',
        'personal library',
        'book collection',
        'book tracker',
        'reading list',
        'library management software',
        'book catalog',
        'free book library app',
        'organize books',
        'AI book scanner',
        'ISBN scanner',
        'book lending tracker',
        'open source library',
        'self-hosted library',
        'privacy-focused library'
    ],
    authors: [{ name: 'Book Guardian', url: 'https://github.com/RuBiCK/bookguardian' }],
    creator: 'Book Guardian',
    publisher: 'Book Guardian',
    applicationName: 'Book Guardian',
    category: 'Productivity',
    classification: 'Library Management',
    icons: {
        icon: '/logo.svg',
        apple: '/apple-icon.png',
    },
    manifest: '/manifest.json',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://bookguardian.marcote.net',
        title: 'Book Guardian - Free Personal Library Management System',
        description: 'Free, open-source personal library management. Organize your books with AI scanning, track lending, and export your data. Sign up free with Google.',
        siteName: 'Book Guardian',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: 'Book Guardian - Personal Library Management System',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Book Guardian - Free Personal Library Management',
        description: 'Free, open-source personal library management. AI book scanning, lending tracker, export to CSV/JSON/MARC21. Sign up free!',
        images: ['/og-image.png'],
        creator: '@bookguardian',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    verification: {
        // Add your verification codes here when available
        // google: 'your-google-verification-code',
        // yandex: 'your-yandex-verification-code',
        // bing: 'your-bing-verification-code',
    },
    alternates: {
        canonical: 'https://bookguardian.marcote.net',
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
                <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded">Skip to main content</a>
                <SessionProvider>
                    <ImpersonationBanner />
                    <main id="main-content" className="container mx-auto px-4 py-6 max-w-5xl">
                        {children}
                    </main>
                    <Navigation />
                </SessionProvider>
            </body>
        </html>
    )
}
