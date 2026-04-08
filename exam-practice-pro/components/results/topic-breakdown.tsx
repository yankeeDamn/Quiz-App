'use client';

import { TopicPerformance } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface TopicBreakdownProps {
  data: TopicPerformance[];
}

export function TopicBreakdown({ data }: TopicBreakdownProps) {
  if (data.length === 0) return null;

  const chartData = data.map((item) => ({
    name: item.topic,
    percentage: Math.round(item.percentage),
    correct: item.correct,
    total: item.total,
  }));

  const getBarColor = (percentage: number) => {
    if (percentage >= 70) return '#22c55e'; // green
    if (percentage >= 50) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Performance by Topic</h3>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              width={75}
            />
            <Tooltip
              formatter={(value, _name, props) => {
                const payload = props.payload as { correct: number; total: number };
                return [`${value}% (${payload.correct}/${payload.total})`, 'Score'];
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
