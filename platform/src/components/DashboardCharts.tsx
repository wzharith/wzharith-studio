'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

interface RevenueData {
  month: string;
  revenue: number;
  count: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

// Revenue Bar Chart
export function RevenueChart({ data }: { data: RevenueData[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            stroke="#64748b"
            fontSize={12}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickFormatter={(value) => `RM${value.toLocaleString()}`}
          />
          <Tooltip
            formatter={(value: number) => [`RM ${value.toLocaleString()}`, 'Revenue']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Bar
            dataKey="revenue"
            fill="#f59e0b"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Revenue Line Chart (alternative view)
export function RevenueTrendChart({ data }: { data: RevenueData[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            stroke="#64748b"
            fontSize={12}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickFormatter={(value) => `RM${value.toLocaleString()}`}
          />
          <Tooltip
            formatter={(value: number) => [`RM ${value.toLocaleString()}`, 'Revenue']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#f59e0b"
            strokeWidth={3}
            dot={{ fill: '#f59e0b', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Status Pie Chart
export function StatusPieChart({ data }: { data: StatusData[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-slate-600 text-sm">{value}</span>}
          />
          <Tooltip
            formatter={(value: number) => [value, 'Count']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Bookings Count Chart
export function BookingsChart({ data }: { data: RevenueData[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            stroke="#64748b"
            fontSize={12}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
          />
          <Tooltip
            formatter={(value: number) => [value, 'Bookings']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          />
          <Bar
            dataKey="count"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
