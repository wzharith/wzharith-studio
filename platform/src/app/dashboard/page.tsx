'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  DollarSign,
  Calendar,
  TrendingUp,
  FileText,
  Users,
  Lock,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Plus,
  LayoutDashboard,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Settings,
  Home,
} from 'lucide-react';
import Link from 'next/link';
import {
  isGoogleSyncEnabled,
  fetchInvoicesFromCloud,
  getAvailability,
  type StoredInvoice,
  type CalendarEventInfo,
  getCalendarEvents,
} from '@/lib/google-sync';
import { RevenueChart, StatusPieChart, BookingsChart } from '@/components/DashboardCharts';
import { isAuthenticated as checkAuth, login as doLogin } from '@/lib/auth';

export default function Dashboard() {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Data state
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [calendarBookedDates, setCalendarBookedDates] = useState<string[]>([]);
  const [calendarEvents, setCalendarEventsData] = useState<CalendarEventInfo[]>([]);

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Check authentication (shared auth)
  useEffect(() => {
    if (checkAuth()) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  // Load data on auth
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (doLogin(password)) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  const loadData = async () => {
    setIsRefreshing(true);

    // Load from localStorage first
    const stored = localStorage.getItem('studio_invoices');
    const localInvoices: StoredInvoice[] = stored ? JSON.parse(stored) : [];
    setInvoices(localInvoices);

    // Try to fetch from cloud
    if (isGoogleSyncEnabled()) {
      // Fetch invoices, calendar availability, and calendar events in parallel
      const [invoicesResult, availabilityResult, eventsResult] = await Promise.all([
        fetchInvoicesFromCloud(),
        getAvailability(calendarDate.getMonth() + 1, calendarDate.getFullYear()),
        getCalendarEvents(),
      ]);

      if (invoicesResult.success && invoicesResult.invoices.length > 0) {
        setInvoices(invoicesResult.invoices as StoredInvoice[]);
      }

      if (availabilityResult && availabilityResult.bookedDates) {
        console.log('[Dashboard] Booked dates from calendar:', availabilityResult.bookedDates);
        setCalendarBookedDates(availabilityResult.bookedDates);
      }

      if (eventsResult && eventsResult.length > 0) {
        console.log('[Dashboard] Calendar events:', eventsResult);
        setCalendarEventsData(eventsResult);
      }
    }

    setIsRefreshing(false);
  };

  // Filter out deleted invoices
  const activeInvoices = useMemo(() =>
    invoices.filter(inv => !inv.deletedAt),
    [invoices]
  );

  // Calculate stats including YTD
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const paid = activeInvoices.filter(inv => inv.status === 'paid');
    const pending = activeInvoices.filter(inv => inv.status === 'sent' || inv.status === 'draft');
    const quotations = activeInvoices.filter(inv => inv.documentType === 'quotation');
    const invoicesDocs = activeInvoices.filter(inv => inv.documentType === 'invoice');

    // YTD: Events completed (past dates with paid status)
    const completedEvents = paid.filter(inv => {
      if (!inv.eventDate) return false;
      return inv.eventDate < todayStr;
    });

    // Upcoming: Events with future dates (any status except cancelled)
    const upcomingEvents = activeInvoices.filter(inv => {
      if (!inv.eventDate || inv.status === 'cancelled') return false;
      return inv.eventDate >= todayStr;
    });

    // This month's events
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();
    const thisMonthEvents = activeInvoices.filter(inv => {
      if (!inv.eventDate) return false;
      const eventDate = new Date(inv.eventDate);
      return eventDate.getMonth() === thisMonth && eventDate.getFullYear() === thisYear;
    });

    const totalRevenue = paid.reduce((sum, inv) => sum + inv.total, 0);
    const pendingAmount = pending.reduce((sum, inv) => sum + inv.total, 0);
    const conversionRate = quotations.length > 0
      ? (invoicesDocs.length / quotations.length * 100).toFixed(0)
      : 0;

    return {
      totalRevenue,
      pendingAmount,
      totalBookings: activeInvoices.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      conversionRate,
      completedEvents: completedEvents.length,
      upcomingEvents: upcomingEvents.length,
      thisMonthEvents: thisMonthEvents.length,
    };
  }, [activeInvoices]);

  // Monthly revenue data for charts
  const monthlyData = useMemo(() => {
    const months: { [key: string]: { revenue: number; count: number } } = {};
    const now = new Date();

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('en-US', { month: 'short' });
      months[key] = { revenue: 0, count: 0 };
    }

    // Aggregate data
    activeInvoices
      .filter(inv => inv.status === 'paid')
      .forEach(inv => {
        const date = new Date(inv.eventDate || inv.createdAt);
        const key = date.toLocaleDateString('en-US', { month: 'short' });
        if (months[key]) {
          months[key].revenue += inv.total;
          months[key].count += 1;
        }
      });

    return Object.entries(months).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      count: data.count,
    }));
  }, [activeInvoices]);

  // Status breakdown for pie chart
  const statusData = useMemo(() => {
    const draft = activeInvoices.filter(inv => inv.status === 'draft').length;
    const sent = activeInvoices.filter(inv => inv.status === 'sent').length;
    const paid = activeInvoices.filter(inv => inv.status === 'paid').length;
    const cancelled = activeInvoices.filter(inv => inv.status === 'cancelled').length;

    return [
      { name: 'Draft', value: draft, color: '#94a3b8' },
      { name: 'Sent', value: sent, color: '#f59e0b' },
      { name: 'Paid', value: paid, color: '#10b981' },
      { name: 'Cancelled', value: cancelled, color: '#ef4444' },
    ].filter(item => item.value > 0);
  }, [activeInvoices]);

  // Calendar events - combine invoice dates with Google Calendar events
  const calendarEventsMap = useMemo(() => {
    const events: { [key: string]: { invoices: StoredInvoice[]; calendarEvents: CalendarEventInfo[] } } = {};

    // Add invoice events
    activeInvoices.forEach(inv => {
      if (inv.eventDate) {
        const dateKey = inv.eventDate;
        if (!events[dateKey]) events[dateKey] = { invoices: [], calendarEvents: [] };
        events[dateKey].invoices.push(inv);
      }
    });

    // Add Google Calendar events with full details
    calendarEvents.forEach(evt => {
      const dateKey = evt.date;
      if (!events[dateKey]) events[dateKey] = { invoices: [], calendarEvents: [] };
      events[dateKey].calendarEvents.push(evt);
    });

    // Also add booked dates that might not have full event info
    calendarBookedDates.forEach(dateKey => {
      if (!events[dateKey]) {
        events[dateKey] = { invoices: [], calendarEvents: [{ date: dateKey, title: 'Booked', venue: '' }] };
      }
    });

    return events;
  }, [activeInvoices, calendarBookedDates, calendarEvents]);

  // Refetch calendar availability when month changes
  useEffect(() => {
    const fetchCalendarAvailability = async () => {
      if (!isGoogleSyncEnabled()) return;

      const result = await getAvailability(
        calendarDate.getMonth() + 1,
        calendarDate.getFullYear()
      );

      if (result && result.bookedDates) {
        setCalendarBookedDates(result.bookedDates);
      }
    };

    fetchCalendarAvailability();
  }, [calendarDate]);

  // Calendar navigation
  const prevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1));
  const nextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1));

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { date: number; dateKey: string; invoices: StoredInvoice[]; calEvents: CalendarEventInfo[]; hasEvent: boolean }[] = [];

    // Empty slots for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: 0, dateKey: '', invoices: [], calEvents: [], hasEvent: false });
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const eventData = calendarEventsMap[dateKey];
      days.push({
        date: day,
        dateKey,
        invoices: eventData?.invoices || [],
        calEvents: eventData?.calendarEvents || [],
        hasEvent: !!eventData && (eventData.invoices.length > 0 || eventData.calendarEvents.length > 0),
      });
    }

    return days;
  }, [calendarDate, calendarEventsMap]);

  // Recent activity
  const recentActivity = useMemo(() =>
    [...activeInvoices]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10),
    [activeInvoices]
  );

  // Status icon
  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'sent': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-amber-100 p-4 rounded-full">
              <LayoutDashboard className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Dashboard</h1>
          <p className="text-slate-500 text-center mb-6">Enter password to access analytics</p>

          <form onSubmit={handleLogin}>
            <div className="relative mb-4">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-amber-500 text-white py-3 rounded-lg font-semibold hover:bg-amber-600 transition-colors"
            >
              View Dashboard
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-slate-500 hover:text-amber-600 text-sm">
              ← Back to Site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-slate-900 text-white py-4 px-6 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-amber-400" />
              Dashboard
            </h1>
            {/* Navigation Links */}
            <nav className="hidden sm:flex items-center gap-1 ml-4 border-l border-slate-700 pl-4">
              <Link
                href="/"
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              >
                <Home className="w-3 h-3" />
                Site
              </Link>
              <Link
                href="/invoice"
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              >
                <FileText className="w-3 h-3" />
                Invoice
              </Link>
              <Link
                href="/admin"
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              >
                <Settings className="w-3 h-3" />
                Admin
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/invoice"
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Quotation
            </Link>
            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Stats Cards - Row 1: Revenue & Pending */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-slate-500 text-sm">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              RM {stats.totalRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-emerald-600 mt-1">{stats.paidCount} paid invoices</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-slate-500 text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              RM {stats.pendingAmount.toLocaleString()}
            </p>
            <p className="text-xs text-amber-600 mt-1">{stats.pendingCount} pending</p>
          </div>

          {/* YTD: Completed Shows */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-slate-500 text-sm">Shows Done (YTD)</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.completedEvents}</p>
            <p className="text-xs text-green-600 mt-1">Completed performances</p>
          </div>

          {/* Upcoming Shows */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-slate-500 text-sm">Upcoming</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.upcomingEvents}</p>
            <p className="text-xs text-blue-600 mt-1">{stats.thisMonthEvents} this month</p>
          </div>
        </div>

        {/* Stats Cards - Row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-slate-100 p-2 rounded-lg">
                <FileText className="w-5 h-5 text-slate-600" />
              </div>
              <span className="text-slate-500 text-sm">Total Bookings</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.totalBookings}</p>
            <p className="text-xs text-slate-600 mt-1">All time</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-purple-100 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-slate-500 text-sm">Conversion Rate</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.conversionRate}%</p>
            <p className="text-xs text-purple-600 mt-1">Quotation → Invoice</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {/* Revenue Chart */}
          <div className="md:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Revenue (Last 6 Months)</h2>
            {monthlyData.some(d => d.revenue > 0) ? (
              <RevenueChart data={monthlyData} />
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400">
                No revenue data yet
              </div>
            )}
          </div>

          {/* Status Breakdown */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Status Breakdown</h2>
            {statusData.length > 0 ? (
              <StatusPieChart data={statusData} />
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                No data yet
              </div>
            )}
          </div>
        </div>

        {/* Calendar & Recent Activity Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Event Calendar</h2>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium w-32 text-center">
                  {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="font-medium text-slate-400 py-1">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => (
                <div
                  key={idx}
                  onClick={() => day.hasEvent && setSelectedDay(day.dateKey === selectedDay ? null : day.dateKey)}
                  className={`aspect-square p-1 text-xs rounded-lg transition-colors ${
                    day.date === 0
                      ? ''
                      : day.hasEvent
                        ? day.dateKey === selectedDay
                          ? 'bg-amber-300 text-amber-900 font-medium cursor-pointer ring-2 ring-amber-500'
                          : 'bg-amber-100 text-amber-800 font-medium cursor-pointer hover:bg-amber-200'
                        : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {day.date > 0 && (
                    <div className="flex flex-col items-center">
                      <span>{day.date}</span>
                      {day.hasEvent && (
                        <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                          day.invoices.length > 0 ? 'bg-amber-500' : 'bg-blue-500'
                        }`}></div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Selected Day Details */}
            {selectedDay && calendarEventsMap[selectedDay] && (
              <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-amber-900">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="text-amber-600 hover:text-amber-800 text-xs"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-2">
                  {/* Show invoice-based events */}
                  {calendarEventsMap[selectedDay].invoices.map((inv, i) => (
                    <div key={`inv-${i}`} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-500">🎷</span>
                      <div>
                        <p className="font-medium text-slate-800">{inv.clientName}</p>
                        <p className="text-slate-500 text-xs">{inv.eventVenue || 'Venue TBC'} • {inv.eventType}</p>
                        <p className="text-xs text-amber-700">RM {inv.total.toLocaleString()} - {inv.status}</p>
                      </div>
                    </div>
                  ))}
                  {/* Show calendar-only events */}
                  {calendarEventsMap[selectedDay].calendarEvents
                    .filter(evt => !calendarEventsMap[selectedDay].invoices.some(inv => evt.title.includes(inv.clientName)))
                    .map((evt, i) => (
                    <div key={`cal-${i}`} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-500">📅</span>
                      <div>
                        <p className="font-medium text-slate-800">{evt.title.replace('🎷 ', '')}</p>
                        {evt.venue && <p className="text-slate-500 text-xs">{evt.venue}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent Activity</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentActivity.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No activity yet</p>
              ) : (
                recentActivity.map(invoice => (
                  <div key={invoice.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50">
                    <StatusIcon status={invoice.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {invoice.clientName || 'Unnamed'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {invoice.invoiceNumber} • {invoice.eventDate || 'No date'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-800">
                        RM {invoice.total.toLocaleString()}
                      </p>
                      <p className={`text-xs capitalize ${
                        invoice.status === 'paid' ? 'text-emerald-600' :
                        invoice.status === 'sent' ? 'text-amber-600' :
                        invoice.status === 'cancelled' ? 'text-red-600' :
                        'text-slate-400'
                      }`}>
                        {invoice.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/invoice"
            className="flex items-center gap-2 bg-white hover:bg-slate-50 px-4 py-2 rounded-lg shadow-sm text-sm text-slate-700"
          >
            <FileText className="w-4 h-4" />
            Invoice Generator
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-2 bg-white hover:bg-slate-50 px-4 py-2 rounded-lg shadow-sm text-sm text-slate-700"
          >
            <Users className="w-4 h-4" />
            Admin Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
