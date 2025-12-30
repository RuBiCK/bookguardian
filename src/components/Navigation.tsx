'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, PlusCircle, BookOpen, Settings, LogOut, Shield } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import { useState, useEffect } from 'react'

export default function Navigation() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)

    const isActive = (path: string) => pathname === path

    // Check if user is admin
    useEffect(() => {
        if (session?.user) {
            fetch('/api/user/me')
                .then(res => res.json())
                .then(data => {
                    if (data.role === 'ADMIN') {
                        setIsAdmin(true)
                    }
                })
                .catch(() => setIsAdmin(false))
        }
    }, [session])

    const handleSignOut = async () => {
        await signOut({ callbackUrl: '/login' })
    }

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 pb-safe pt-2 px-6 z-50 md:top-0 md:bottom-auto md:h-16 md:border-t-0 md:border-b md:flex md:items-center md:justify-between md:px-8">
            <div className="hidden md:flex items-center gap-3">
                <Image src="/logo.svg" alt="Book Guardian" width={32} height={32} className="text-amber-700 dark:text-amber-500" />
                <div className="text-xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
                    Book Guardian
                </div>
            </div>

            <div className="flex justify-between items-center md:gap-8">
                <Link href="/library" className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive('/library') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Home size={24} />
                    <span className="text-[10px] md:text-xs font-medium">Home</span>
                </Link>

                <Link href="/add-book" className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive('/add-book') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    <PlusCircle size={24} />
                    <span className="text-[10px] md:text-xs font-medium">Add Book</span>
                </Link>

                <Link href="/libraries" className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive('/libraries') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    <BookOpen size={24} />
                    <span className="text-[10px] md:text-xs font-medium">Libraries</span>
                </Link>

                <Link href="/settings" className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive('/settings') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Settings size={24} />
                    <span className="text-[10px] md:text-xs font-medium">Settings</span>
                </Link>
            </div>

            {/* User Profile Menu - Desktop Only */}
            {session?.user && (
                <div className="hidden md:block relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors"
                    >
                        {session.user.image ? (
                            <Image
                                src={session.user.image}
                                alt={session.user.name || 'User'}
                                width={32}
                                height={32}
                                className="rounded-full"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                                {session.user.name?.[0] || session.user.email?.[0] || 'U'}
                            </div>
                        )}
                        <span className="text-sm font-medium max-w-[150px] truncate">
                            {session.user.name || session.user.email}
                        </span>
                    </button>

                    {/* Dropdown Menu */}
                    {showUserMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-[100]"
                                onClick={() => setShowUserMenu(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-2xl py-2 z-[110]">
                                <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                                    <p className="text-sm font-medium">{session.user.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {session.user.email}
                                    </p>
                                </div>
                                {isAdmin && (
                                    <Link
                                        href="/admin"
                                        onClick={() => setShowUserMenu(false)}
                                        className="w-full px-4 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                                    >
                                        <Shield size={16} />
                                        Admin Dashboard
                                    </Link>
                                )}
                                <button
                                    onClick={handleSignOut}
                                    className="w-full px-4 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 text-red-600 dark:text-red-400"
                                >
                                    <LogOut size={16} />
                                    Sign Out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </nav>
    )
}
