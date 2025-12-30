'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { BookOpen, Heart, Tag, Users, Lock, Download, Github, ArrowRight, Star, Shield, Zap, Camera, Sparkles, ScanLine, Library, BarChart3 } from 'lucide-react'

export default function LandingPage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      {/* Header - Minimal with only profile/login */}
      <header className="fixed top-0 right-0 z-50 p-6">
        {session ? (
          <Link href="/library" className="flex items-center hover:scale-105 transition-transform">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name || 'User'}
                width={48}
                height={48}
                className="rounded-full border-2 border-amber-200 dark:border-amber-800 hover:border-amber-400 transition-colors shadow-lg"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-semibold border-2 border-amber-200 dark:border-amber-800 hover:border-amber-400 transition-colors shadow-lg">
                {session.user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </Link>
        ) : (
          <Link
            href="/login"
            className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl font-medium"
          >
            Login
          </Link>
        )}
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
                  href="https://github.com/RuBiCK/bookguardian"
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

      {/* AI Camera Feature - Highlighted Section */}
      <section className="py-24 px-6 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 relative overflow-hidden">
        {/* Subtle background elements */}
        <div className="absolute inset-0 overflow-hidden opacity-40">
          <div className="absolute w-96 h-96 bg-amber-200/20 rounded-full blur-3xl -top-48 -left-48"></div>
          <div className="absolute w-96 h-96 bg-orange-200/20 rounded-full blur-3xl -bottom-48 -right-48"></div>
        </div>

        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-800 dark:text-amber-200 text-sm font-medium border border-amber-200 dark:border-amber-800">
                <Sparkles className="w-4 h-4" />
                <span>Powered by AI</span>
              </div>

              <h2 className="text-4xl lg:text-5xl font-bold leading-tight text-neutral-900 dark:text-white">
                📸 Snap a Photo,
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">
                  AI Does the Rest
                </span>
              </h2>

              <p className="text-xl text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Just take a picture of your book's cover, and our AI instantly extracts all the details—title, author, ISBN, and more. No typing, no searching, just magic.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                    <Camera className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1 text-neutral-900 dark:text-white">Instant Recognition</h3>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">AI analyzes the book cover and extracts all metadata automatically</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                    <ScanLine className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1 text-neutral-900 dark:text-white">Auto-Complete Details</h3>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">Title, author, publisher, year, ISBN—all filled in seconds</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1 text-neutral-900 dark:text-white">Smart & Fast</h3>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">Add dozens of books to your library in minutes, not hours</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Library Visualization with Shelves */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-200 to-orange-200 dark:from-amber-900/20 dark:to-orange-900/20 rounded-3xl blur-2xl opacity-20"></div>
              <div className="relative bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-3xl p-8 border border-neutral-200 dark:border-neutral-700 shadow-xl">
                <svg viewBox="0 0 400 500" className="w-full h-auto">
                  {/* Library Structure */}

                  {/* Library 1 - Left Side */}
                  <g id="library1">
                    {/* Frame */}
                    <rect x="10" y="20" width="180" height="220" rx="8" fill="#D4A574" fillOpacity="0.15" stroke="#C4956C" strokeWidth="2" />
                    <text x="100" y="15" textAnchor="middle" fill="#8B7355" fontSize="12" fontWeight="bold">Home Library</text>

                    {/* Shelf 1 */}
                    <line x1="20" y1="80" x2="180" y2="80" stroke="#A88860" strokeWidth="3" />
                    {/* Books on shelf 1 */}
                    <rect x="25" y="45" width="18" height="35" rx="2" fill="#D4A574" />
                    <rect x="45" y="40" width="22" height="40" rx="2" fill="#C4956C" />
                    <rect x="69" y="47" width="16" height="33" rx="2" fill="#E8C4A0" />
                    <rect x="87" y="42" width="20" height="38" rx="2" fill="#B89968" />
                    <rect x="109" y="44" width="19" height="36" rx="2" fill="#D9B99B" />
                    <rect x="130" y="38" width="23" height="42" rx="2" fill="#A88860" />
                    <rect x="155" y="46" width="17" height="34" rx="2" fill="#E0B896" />

                    {/* Shelf 2 */}
                    <line x1="20" y1="140" x2="180" y2="140" stroke="#A88860" strokeWidth="3" />
                    {/* Books on shelf 2 */}
                    <rect x="25" y="108" width="20" height="32" rx="2" fill="#C9A07A" />
                    <rect x="47" y="103" width="18" height="37" rx="2" fill="#E0B896" />
                    <rect x="67" y="110" width="24" height="30" rx="2" fill="#D4A574" />
                    <rect x="93" y="105" width="17" height="35" rx="2" fill="#B89968" />
                    <rect x="112" y="107" width="21" height="33" rx="2" fill="#E8C4A0" />
                    <rect x="135" y="102" width="19" height="38" rx="2" fill="#C4956C" />
                    <rect x="156" y="109" width="16" height="31" rx="2" fill="#D9B99B" />

                    {/* Shelf 3 */}
                    <line x1="20" y1="200" x2="180" y2="200" stroke="#A88860" strokeWidth="3" />
                    {/* Books on shelf 3 */}
                    <rect x="25" y="165" width="22" height="35" rx="2" fill="#A88860" />
                    <rect x="49" y="168" width="19" height="32" rx="2" fill="#D4A574" />
                    <rect x="70" y="162" width="17" height="38" rx="2" fill="#E0B896" />
                    <rect x="89" y="167" width="23" height="33" rx="2" fill="#C9A07A" />
                    <rect x="114" y="164" width="18" height="36" rx="2" fill="#B89968" />
                    <rect x="134" y="169" width="20" height="31" rx="2" fill="#E8C4A0" />
                    <rect x="156" y="163" width="16" height="37" rx="2" fill="#D9B99B" />
                  </g>

                  {/* Library 2 - Right Side */}
                  <g id="library2">
                    {/* Frame */}
                    <rect x="210" y="20" width="180" height="220" rx="8" fill="#D4A574" fillOpacity="0.15" stroke="#C4956C" strokeWidth="2" />
                    <text x="300" y="15" textAnchor="middle" fill="#8B7355" fontSize="12" fontWeight="bold">Office Library</text>

                    {/* Shelf 1 */}
                    <line x1="220" y1="80" x2="380" y2="80" stroke="#A88860" strokeWidth="3" />
                    {/* Books on shelf 1 */}
                    <rect x="225" y="43" width="19" height="37" rx="2" fill="#C4956C" />
                    <rect x="246" y="47" width="22" height="33" rx="2" fill="#D4A574" />
                    <rect x="270" y="41" width="18" height="39" rx="2" fill="#E8C4A0" />
                    <rect x="290" y="45" width="21" height="35" rx="2" fill="#D9B99B" />
                    <rect x="313" y="39" width="17" height="41" rx="2" fill="#B89968" />
                    <rect x="332" y="44" width="23" height="36" rx="2" fill="#C9A07A" />
                    <rect x="357" y="48" width="16" height="32" rx="2" fill="#E0B896" />

                    {/* Shelf 2 */}
                    <line x1="220" y1="140" x2="380" y2="140" stroke="#A88860" strokeWidth="3" />
                    {/* Books on shelf 2 */}
                    <rect x="225" y="106" width="21" height="34" rx="2" fill="#A88860" />
                    <rect x="248" y="109" width="18" height="31" rx="2" fill="#D4A574" />
                    <rect x="268" y="103" width="20" height="37" rx="2" fill="#C4956C" />
                    <rect x="290" y="108" width="24" height="32" rx="2" fill="#E0B896" />
                    <rect x="316" y="105" width="17" height="35" rx="2" fill="#B89968" />
                    <rect x="335" y="110" width="19" height="30" rx="2" fill="#E8C4A0" />
                    <rect x="356" y="107" width="16" height="33" rx="2" fill="#D9B99B" />

                    {/* Shelf 3 */}
                    <line x1="220" y1="200" x2="380" y2="200" stroke="#A88860" strokeWidth="3" />
                    {/* Books on shelf 3 */}
                    <rect x="225" y="166" width="20" height="34" rx="2" fill="#C9A07A" />
                    <rect x="247" y="163" width="22" height="37" rx="2" fill="#D4A574" />
                    <rect x="271" y="168" width="17" height="32" rx="2" fill="#B89968" />
                    <rect x="290" y="164" width="19" height="36" rx="2" fill="#E8C4A0" />
                    <rect x="311" y="167" width="23" height="33" rx="2" fill="#D9B99B" />
                    <rect x="336" y="162" width="18" height="38" rx="2" fill="#C4956C" />
                    <rect x="356" y="169" width="16" height="31" rx="2" fill="#E0B896" />
                  </g>

                  {/* Camera Icon with subtle effect */}
                  <g id="camera-icon">
                    <circle cx="200" cy="240" r="30" fill="#D4A574" opacity="0.2" />
                    <circle cx="200" cy="240" r="24" fill="#F59E0B" />
                    <rect x="190" y="234" width="20" height="12" rx="2" fill="#FFF" />
                    <circle cx="200" cy="240" r="7" fill="#FFF" opacity="0.6" />
                    {/* Subtle sparkles */}
                    <circle cx="175" cy="220" r="2" fill="#F59E0B" opacity="0.6">
                      <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="225" cy="225" r="1.5" fill="#F59E0B" opacity="0.6">
                      <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="210" cy="260" r="2" fill="#F59E0B" opacity="0.6">
                      <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2.8s" repeatCount="indefinite" />
                    </circle>
                  </g>
                </svg>

                <div className="mt-6 text-center">
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    📚 Multiple libraries • 🏷️ Custom shelves • 📖 Organized collection
                  </p>
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
            {/* Feature 1 - AI Camera (Highlighted) */}
            <div className="group p-8 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 hover:shadow-xl transition-all hover:-translate-y-1 relative">
              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                  <Camera className="text-white" size={28} />
                </div>
                <div className="absolute -top-1 -right-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI
                </div>
                <h3 className="text-2xl font-bold mb-3">📸 AI Camera Scan</h3>
                <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Just snap a photo of your book's cover and let AI extract all the details instantly. No typing required!
                </p>
              </div>
            </div>

            {/* Feature 2 - Organize */}
            <div className="group p-8 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-neutral-800 dark:to-neutral-800 rounded-2xl border border-amber-200 dark:border-neutral-700 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BookOpen className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3">Organize Libraries</h3>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Create multiple libraries and custom shelves. Organize your collection exactly how you want it.
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

            {/* Feature 7 - Admin Dashboard */}
            <div className="group p-8 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-neutral-800 dark:to-neutral-800 rounded-2xl border border-indigo-200 dark:border-neutral-700 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="text-white" size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3">Admin Dashboard</h3>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Track AI usage, manage user quotas, and monitor platform statistics. Full control for multi-user deployments.
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
                href="https://github.com/RuBiCK/bookguardian"
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
git clone https://github.com/RuBiCK/bookguardian.git

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
              href="https://github.com/RuBiCK/bookguardian"
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
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 6l4 14" />
                    <path d="M12 6v14" />
                    <path d="M8 8v12" />
                    <path d="M4 4v16" />
                  </svg>
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
                <li><a href="https://github.com/RuBiCK/bookguardian" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">GitHub</a></li>
                <li><a href="https://github.com/RuBiCK/bookguardian/blob/main/README.md" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Documentation</a></li>
                <li><a href="https://github.com/RuBiCK/bookguardian/issues" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Issues</a></li>
                <li><a href="https://github.com/RuBiCK/bookguardian/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Contribute</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Community</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="https://github.com/RuBiCK/bookguardian/discussions" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Discussions</a></li>
                <li><a href="https://twitter.com/bookguardian" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Twitter</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-neutral-400">
            <p>© {new Date().getFullYear()} Book Guardian. Licensed under PolyForm Noncommercial 1.0.0</p>
            <p>Made with ❤️ for book lovers everywhere</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
