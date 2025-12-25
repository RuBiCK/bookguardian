'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { BookOpen, Heart, Tag, Users, Lock, Download, Github, ArrowRight, Star, Shield, Zap } from 'lucide-react'

export default function LandingPage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-amber-200 dark:border-neutral-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <BookOpen className="text-white" size={24} />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
              Book Guardian
            </span>
          </div>

          <nav className="flex items-center gap-6">
            <a href="#features" className="text-neutral-600 hover:text-amber-700 dark:text-neutral-300 dark:hover:text-amber-400 transition-colors font-medium">
              Features
            </a>
            <a href="#open-source" className="text-neutral-600 hover:text-amber-700 dark:text-neutral-300 dark:hover:text-amber-400 transition-colors font-medium">
              Open Source
            </a>
            {session ? (
              <Link
                href="/library"
                className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                Go to Library
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-800 dark:text-amber-300 text-sm font-medium">
                <Star className="w-4 h-4" />
                <span>Open Source & Self-Hosted</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
                Your Personal{' '}
                <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  Library
                </span>
                <br />
                Guardian
              </h1>

              <p className="text-xl text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Organize, track, and cherish your book collection with a beautiful,
                privacy-focused library management system. Built for book lovers, by book lovers.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href={session ? "/library" : "/login"}
                  className="group px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all shadow-xl hover:shadow-2xl font-semibold text-lg flex items-center gap-2"
                >
                  {session ? "Open Your Library" : "Get Started Free"}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>

                <a
                  href="https://github.com/yourusername/book-guardian"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-white rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all shadow-lg hover:shadow-xl font-semibold text-lg flex items-center gap-2 border-2 border-neutral-200 dark:border-neutral-700"
                >
                  <Github className="w-5 h-5" />
                  View on GitHub
                </a>
              </div>

              <div className="flex items-center gap-8 pt-4 text-sm text-neutral-500 dark:text-neutral-400">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span>100% Private</span>
                </div>
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>Self-Hosted</span>
                </div>
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-purple-600" />
                  <span>Open Source</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-3xl blur-3xl opacity-20"></div>
              <div className="relative bg-white dark:bg-neutral-800 rounded-3xl shadow-2xl p-8 border border-neutral-200 dark:border-neutral-700">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <div className="w-16 h-20 bg-gradient-to-br from-amber-200 to-orange-300 dark:from-amber-700 dark:to-orange-800 rounded-lg flex items-center justify-center">
                      <BookOpen className="text-amber-800 dark:text-amber-200" size={32} />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-2"></div>
                      <div className="h-2 bg-neutral-100 dark:bg-neutral-600 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                    <div className="w-16 h-20 bg-gradient-to-br from-orange-200 to-red-300 dark:from-orange-700 dark:to-red-800 rounded-lg flex items-center justify-center">
                      <BookOpen className="text-orange-800 dark:text-orange-200" size={32} />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3 mb-2"></div>
                      <div className="h-2 bg-neutral-100 dark:bg-neutral-600 rounded w-1/3"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <div className="w-16 h-20 bg-gradient-to-br from-yellow-200 to-amber-300 dark:from-yellow-700 dark:to-amber-800 rounded-lg flex items-center justify-center">
                      <BookOpen className="text-amber-800 dark:text-amber-200" size={32} />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-4/5 mb-2"></div>
                      <div className="h-2 bg-neutral-100 dark:bg-neutral-600 rounded w-2/5"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-white dark:bg-neutral-900">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Manage Your Collection
              </span>
            </h2>
            <p className="text-xl text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto">
              A complete library management system with all the features you need, none of the complexity you don't.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group p-8 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-neutral-800 dark:to-neutral-800 rounded-2xl border border-amber-200 dark:border-neutral-700 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BookOpen className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3">Organize Your Books</h3>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Create custom libraries and shelves. Add books manually, via ISBN, or with AI-powered camera scanning.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-neutral-800 dark:to-neutral-800 rounded-2xl border border-blue-200 dark:border-neutral-700 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Tag className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3">Smart Tagging</h3>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Categorize with custom tags. Search across titles, authors, ISBN, publishers, and more with powerful filters.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-neutral-800 dark:to-neutral-800 rounded-2xl border border-green-200 dark:border-neutral-700 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3">Track Lending</h3>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Keep track of books you've lent to friends. Never lose track of your collection again.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group p-8 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-neutral-800 dark:to-neutral-800 rounded-2xl border border-purple-200 dark:border-neutral-700 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Heart className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3">Reading Status</h3>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Track what you want to read, are currently reading, or have finished. Rate and review your favorites.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group p-8 bg-gradient-to-br from-red-50 to-orange-50 dark:from-neutral-800 dark:to-neutral-800 rounded-2xl border border-red-200 dark:border-neutral-700 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Lock className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3">Privacy First</h3>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Your data stays yours. Self-hosted, encrypted, and completely under your control. Multi-user with data isolation.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group p-8 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-neutral-800 dark:to-neutral-800 rounded-2xl border border-yellow-200 dark:border-neutral-700 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Download className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3">Export Anywhere</h3>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Export your library in CSV, JSON, or MARC21 format. Your data is portable and never locked in.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Open Source Section */}
      <section id="open-source" className="py-20 px-6 bg-gradient-to-br from-neutral-900 to-neutral-950 text-white">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 rounded-full text-amber-300 text-sm font-medium mb-6">
                <Github className="w-4 h-4" />
                <span>Free & Open Source</span>
              </div>

              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                Built in the Open,
                <br />
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  For Everyone
                </span>
              </h2>

              <p className="text-xl text-neutral-300 leading-relaxed mb-8">
                Book Guardian is 100% open source and free to use. Built with modern web technologies
                and designed to be self-hosted on your own infrastructure.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="text-lg">Next.js 16 + React 19 + TypeScript</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-lg">PostgreSQL + Prisma ORM</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-lg">Google OAuth + NextAuth.js</span>
                </div>
              </div>

              <a
                href="https://github.com/yourusername/book-guardian"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-neutral-900 rounded-xl hover:bg-neutral-100 transition-all shadow-xl hover:shadow-2xl font-semibold text-lg"
              >
                <Github className="w-5 h-5" />
                Star on GitHub
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>

            <div className="bg-neutral-800 rounded-2xl p-8 border border-neutral-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-sm text-neutral-400">Terminal</span>
              </div>
              <pre className="text-sm text-neutral-300 font-mono overflow-x-auto">
                <code>{`# Clone the repository
git clone https://github.com/yourusername/book-guardian.git

# Install dependencies
cd book-guardian
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate deploy

# Start the development server
npm run dev

# Or deploy with Docker
docker-compose up -d`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Ready to Guard Your Books?
          </h2>
          <p className="text-xl mb-8 text-amber-50">
            Join book lovers worldwide who trust Book Guardian to manage their collections.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href={session ? "/library" : "/login"}
              className="px-8 py-4 bg-white text-amber-700 rounded-xl hover:bg-neutral-50 transition-all shadow-xl hover:shadow-2xl font-semibold text-lg"
            >
              {session ? "Go to Your Library" : "Get Started Free"}
            </Link>
            <a
              href="https://github.com/yourusername/book-guardian"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-amber-700 text-white rounded-xl hover:bg-amber-800 transition-all shadow-xl hover:shadow-2xl font-semibold text-lg flex items-center gap-2"
            >
              <Github className="w-5 h-5" />
              View Documentation
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-neutral-900 text-neutral-300 border-t border-neutral-800">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <BookOpen className="text-white" size={18} />
                </div>
                <span className="text-lg font-bold text-white">Book Guardian</span>
              </div>
              <p className="text-sm text-neutral-400">
                Your personal library management system. Open source and privacy-focused.
              </p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-amber-400 transition-colors">Features</a></li>
                <li><Link href="/login" className="hover:text-amber-400 transition-colors">Login</Link></li>
                <li><Link href="/privacy" className="hover:text-amber-400 transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-amber-400 transition-colors">Terms</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Developers</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="https://github.com/yourusername/book-guardian" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">GitHub</a></li>
                <li><a href="https://github.com/yourusername/book-guardian/blob/main/README.md" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Documentation</a></li>
                <li><a href="https://github.com/yourusername/book-guardian/issues" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Issues</a></li>
                <li><a href="https://github.com/yourusername/book-guardian/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Contribute</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Community</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="https://github.com/yourusername/book-guardian/discussions" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Discussions</a></li>
                <li><a href="https://twitter.com/bookguardian" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Twitter</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-neutral-400">
            <p>© {new Date().getFullYear()} Book Guardian. Open source under MIT License.</p>
            <p>Made with ❤️ for book lovers everywhere</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
