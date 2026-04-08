'use client';

import { QuizResult } from '@/lib/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PerformanceChartProps {
  data: QuizResult[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  if (data.length === 0) return null;

  // Transform data for chart - most recent 10 attempts
  const chartData = [...data]
    .slice(0, 10)
    .reverse()
    .map((result, index) => ({
      attempt: index + 1,
      score: Math.round(result.percentage),
      quiz: result.quizTitle,
      date: new Date(result.completedAt).toLocaleDateString(),
    }));

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="attempt"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-lg">
                    <p className="font-medium">{data.quiz}</p>
                    <p className="text-sm text-muted-foreground">{data.date}</p>
                    <p className="mt-1 text-lg font-bold text-indigo-600">
                      {data.score}%
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={3}
            dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#6366f1' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
