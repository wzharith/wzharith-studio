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
  compareRevenue?: number;
  compareCount?: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

// Revenue Bar Chart with optional comparison
export function RevenueChart({ data, showComparison = false }: { data: RevenueData[]; showComparison?: boolean }) {
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
            formatter={(value: number, name: string) => [
              `RM ${value.toLocaleString()}`,
              name === 'revenue' ? 'Current Year' : 'Previous Year'
            ]}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          {showComparison && (
            <Bar
              dataKey="compareRevenue"
              fill="#cbd5e1"
              radius={[4, 4, 0, 0]}
              name="compareRevenue"
            />
          )}
          <Bar
            dataKey="revenue"
            fill="#f59e0b"
            radius={[4, 4, 0, 0]}
            name="revenue"
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

// Lead Source Pie Chart
interface SubBreakdown {
  name: string;
  count: number;
  revenue: number;
}

interface LeadSourceData {
  name: string;
  value: number;
  revenue: number;
  color: string;
  breakdown?: SubBreakdown[];
}

const LEAD_SOURCE_COLORS: Record<string, string> = {
  'Web': '#3b82f6',
  'Instagram': '#ec4899',
  'WhatsApp': '#22c55e',
  'TikTok': '#000000',
  'Referral': '#8b5cf6',
  'Collaboration': '#f59e0b',
  'Other': '#6b7280',
  'Unknown': '#cbd5e1',
  '': '#cbd5e1',
};

// Custom tooltip component for lead source with breakdown
const LeadSourceTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: LeadSourceData }> }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="font-semibold text-slate-800 mb-1">{data.name || 'Unknown'}</div>
      <div className="text-slate-600">
        {data.value} bookings • RM {data.revenue.toLocaleString()}
      </div>
      {data.breakdown && data.breakdown.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          {data.breakdown.map((sub, i) => (
            <div key={i} className="flex justify-between text-xs text-slate-500 mt-0.5">
              <span>└ {sub.name}</span>
              <span>{sub.count} (RM {sub.revenue.toLocaleString()})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function LeadSourcePieChart({ data }: { data: LeadSourceData[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }) => name ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-slate-600 text-xs">{value}</span>}
          />
          <Tooltip content={<LeadSourceTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export { LEAD_SOURCE_COLORS };

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

interface PackageData {
  name: string;
  count: number;
  revenue: number;
  avgValue: number;
  color: string;
}

// Package Performance Pie Chart
export function PackagePieChart({ data }: { data: PackageData[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={3}
            dataKey="count"
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
            formatter={(value) => <span className="text-slate-600 text-xs">{value}</span>}
          />
          <Tooltip
            formatter={(value: number, name: string, props) => {
              const entry = props.payload as PackageData;
              return [
                <div key="tooltip" className="text-xs">
                  <div>{value} bookings</div>
                  <div>RM {entry.revenue.toLocaleString()} total</div>
                  <div>RM {entry.avgValue.toLocaleString()} avg</div>
                </div>,
                name
              ];
            }}
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

// Package Revenue Bar Chart
export function PackageRevenueChart({ data }: { data: PackageData[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis
            type="number"
            stroke="#64748b"
            fontSize={12}
            tickFormatter={(value) => `RM${value.toLocaleString()}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#64748b"
            fontSize={11}
            width={55}
          />
          <Tooltip
            formatter={(value: number) => [`RM ${value.toLocaleString()}`, 'Revenue']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          />
          <Bar
            dataKey="revenue"
            radius={[0, 4, 4, 0]}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ConversionData {
  stage: string;
  count: number;
  color: string;
}

// Conversion Funnel Chart
export function ConversionFunnelChart({ data }: { data: ConversionData[] }) {
  const maxValue = Math.max(...data.map(d => d.count));

  return (
    <div className="space-y-3">
      {data.map((stage, index) => {
        const widthPercent = maxValue > 0 ? (stage.count / maxValue) * 100 : 0;
        return (
          <div key={stage.stage} className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700">{stage.stage}</span>
              <span className="text-sm font-bold text-slate-800">{stage.count}</span>
            </div>
            <div className="h-8 bg-slate-100 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-500"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: stage.color,
                }}
              />
            </div>
            {index < data.length - 1 && data[index + 1].count > 0 && stage.count > 0 && (
              <div className="text-xs text-slate-500 mt-1 text-right">
                {((data[index + 1].count / stage.count) * 100).toFixed(0)}% conversion
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
