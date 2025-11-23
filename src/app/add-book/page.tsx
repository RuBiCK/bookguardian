'use client'

import { useState } from 'react'
import { PenTool, ScanBarcode, Camera } from 'lucide-react'
import AddBookManual from '@/components/AddBookManual'
import AddBookISBN from '@/components/AddBookISBN'
import AddBookCamera from '@/components/AddBookCamera'

export default function AddBookPage() {
    const [activeTab, setActiveTab] = useState<'manual' | 'isbn' | 'camera'>('manual')
    const [scannedData, setScannedData] = useState<any>(null)

    const handleScanComplete = (data: any) => {
        setScannedData(data)
        setActiveTab('manual')
    }

    return (
        <div className="max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-6">Add New Book</h1>

            <div className="flex p-1 bg-secondary rounded-xl mb-8">
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'manual' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                >
                    <PenTool size={16} />
                    Manual
                </button>
                <button
                    onClick={() => setActiveTab('isbn')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'isbn' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                >
                    <ScanBarcode size={16} />
                    ISBN
                </button>
                <button
                    onClick={() => setActiveTab('camera')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'camera' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                >
                    <Camera size={16} />
                    Camera
                </button>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                {activeTab === 'manual' && <AddBookManual initialData={scannedData} />}
                {activeTab === 'isbn' && <AddBookISBN onScanComplete={handleScanComplete} />}
                {activeTab === 'camera' && <AddBookCamera onScanComplete={handleScanComplete} />}
            </div>
        </div>
    )
}
