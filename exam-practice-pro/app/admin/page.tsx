'use client';

import { useEffect, useState } from 'react';
import { Users, CreditCard, BookOpen, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAdminStats, type AdminStats } from '@/lib/api';

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    user: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    guest: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return map[role] ?? map.user;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats().then((res) => {
      if (res.success && res.data) setStats(res.data);
      else setError(res.error?.message ?? 'Failed to load stats');
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400">
        {error}
      </div>
    );
  }

  const revenue = stats ? (stats.totalRevenueCents / 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          description={`${stats?.paidUsers ?? 0} paid`}
        />
        <StatCard
          title="Paid Users"
          value={stats?.paidUsers ?? 0}
          icon={Users}
          description="Full access granted"
        />
        <StatCard
          title="Quiz Attempts"
          value={stats?.totalAttempts ?? 0}
          icon={BookOpen}
          description="All time"
        />
        <StatCard
          title="Revenue"
          value={`$${revenue}`}
          icon={DollarSign}
          description="Stripe succeeded payments"
        />
      </div>

      {/* Recent users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Recent Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentUsers?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Email / Name</th>
                    <th className="pb-2 text-left font-medium">Role</th>
                    <th className="pb-2 text-left font-medium">Payment</th>
                    <th className="pb-2 text-left font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.recentUsers.map((u) => (
                    <tr key={u.id} className="py-2">
                      <td className="py-2">
                        <div className="font-medium">{u.name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{u.email ?? '—'}</div>
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge(u.role)}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2">
                        <Badge variant="outline">{u.payment_status}</Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No users yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
