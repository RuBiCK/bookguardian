'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, PlusCircle, BookOpen, Settings } from 'lucide-react'

export default function Navigation() {
    const pathname = usePathname()

    const isActive = (path: string) => pathname === path

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 pb-safe pt-2 px-6 z-50 md:top-0 md:bottom-auto md:h-16 md:border-t-0 md:border-b md:flex md:items-center md:justify-between md:px-8">
            <div className="hidden md:block text-xl font-bold text-primary">
                MyLibrary
            </div>

            <div className="flex justify-between items-center md:gap-8">
                <Link href="/" className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive('/') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
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
        </nav>
    )
}
