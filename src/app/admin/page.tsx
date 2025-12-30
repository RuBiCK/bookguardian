'use client'

import { useState, useEffect } from 'react'
import { Shield, Users, Activity, Zap, TrendingUp, Clock } from 'lucide-react'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  tier: string
  monthlyTokenQuota: number
  monthlyCallQuota: number
  tokensUsed: number
  callsUsed: number
  quotaResetDate: string
  createdAt: string
  _count: {
    libraries: number
    usageLogs: number
  }
}

interface Stats {
  totalUsers: number
  tierDistribution: Array<{ tier: string; _count: number }>
  usage: {
    totalTokens: number
    totalCalls: number
    last24Hours: {
      tokens: number
      calls: number
    }
  }
  recentLogs: Array<{
    id: string
    operation: string
    totalTokens: number
    cost: number
    createdAt: string
    user: {
      email: string
      name: string | null
    }
  }>
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/stats'),
      ])

      if (usersRes.status === 403 || statsRes.status === 403) {
        setError('Admin access required')
        return
      }

      if (!usersRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const usersData = await usersRes.json()
      const statsData = await statsRes.json()

      setUsers(usersData.users)
      setStats(statsData)
    } catch (err) {
      setError('Failed to load admin data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const updateUserTier = async (userId: string, newTier: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: newTier }),
      })

      if (res.ok) {
        fetchData() // Refresh
      }
    } catch (err) {
      console.error('Error updating user:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">{error}</h2>
          <p className="text-muted-foreground">You need admin permissions to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={32} className="text-primary" />
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users size={20} className="text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Users</span>
            </div>
            <p className="text-3xl font-bold">{stats.totalUsers}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Activity size={20} className="text-green-500" />
              <span className="text-sm text-muted-foreground">Total Tokens</span>
            </div>
            <p className="text-3xl font-bold">
              {(stats.usage.totalTokens / 1000).toFixed(1)}k
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Zap size={20} className="text-amber-500" />
              <span className="text-sm text-muted-foreground">API Calls</span>
            </div>
            <p className="text-3xl font-bold">{stats.usage.totalCalls}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp size={20} className="text-purple-500" />
              <span className="text-sm text-muted-foreground">Last 24h</span>
            </div>
            <p className="text-3xl font-bold">{stats.usage.last24Hours.calls}</p>
            <p className="text-xs text-muted-foreground">calls</p>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">User Management</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 text-sm font-medium text-muted-foreground">User</th>
                <th className="pb-3 text-sm font-medium text-muted-foreground">Tier</th>
                <th className="pb-3 text-sm font-medium text-muted-foreground">Tokens</th>
                <th className="pb-3 text-sm font-medium text-muted-foreground">Calls</th>
                <th className="pb-3 text-sm font-medium text-muted-foreground">Role</th>
                <th className="pb-3 text-sm font-medium text-muted-foreground">Libraries</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="py-3">
                    <div>
                      <div className="font-medium">{user.name || 'No name'}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </td>
                  <td className="py-3">
                    <select
                      value={user.tier}
                      onChange={(e) => updateUserTier(user.id, e.target.value)}
                      className="px-3 py-1 border border-border rounded-lg bg-background text-sm hover:bg-secondary cursor-pointer"
                    >
                      <option value="FREE">Free</option>
                      <option value="PRO">Pro</option>
                      <option value="UNLIMITED">Unlimited</option>
                    </select>
                  </td>
                  <td className="py-3">
                    <div className="text-sm">
                      {user.tokensUsed.toLocaleString()} / {user.monthlyTokenQuota.toLocaleString()}
                    </div>
                    <div className="w-24 h-1.5 bg-secondary rounded-full mt-1">
                      <div
                        className={`h-full rounded-full ${
                          user.tokensUsed / user.monthlyTokenQuota > 0.9
                            ? 'bg-red-500'
                            : user.tokensUsed / user.monthlyTokenQuota > 0.7
                            ? 'bg-amber-500'
                            : 'bg-primary'
                        }`}
                        style={{
                          width: `${Math.min(
                            (user.tokensUsed / user.monthlyTokenQuota) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-3 text-sm">
                    {user.callsUsed} / {user.monthlyCallQuota}
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        user.role === 'ADMIN'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-center">{user._count.libraries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      {stats && stats.recentLogs.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={20} />
            <h2 className="text-xl font-semibold">Recent Activity</h2>
          </div>

          <div className="space-y-2">
            {stats.recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div>
                  <div className="text-sm font-medium">
                    {log.user.name || log.user.email}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {log.operation} • {log.totalTokens.toLocaleString()} tokens
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">${log.cost.toFixed(4)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
