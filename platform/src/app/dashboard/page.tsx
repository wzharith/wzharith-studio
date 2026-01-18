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
  Phone,
  MapPin,
  Music,
  MessageCircle,
  ExternalLink,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  isGoogleSyncEnabled,
  fetchInvoicesFromCloud,
  getAvailability,
  type StoredInvoice,
  type CalendarEventInfo,
  getCalendarEvents,
} from '@/lib/google-sync';
import { RevenueChart, StatusPieChart, PackagePieChart, ConversionFunnelChart, LeadSourcePieChart, LEAD_SOURCE_COLORS } from '@/components/DashboardCharts';
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

  // Year selector state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [compareYear, setCompareYear] = useState<number | null>(null);

  // Invoice list modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilter, setModalFilter] = useState<string | null>(null);

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    invoices.forEach(inv => {
      if (inv.eventDate) {
        const year = new Date(inv.eventDate).getFullYear();
        years.add(year);
      }
      if (inv.createdAt) {
        const year = new Date(inv.createdAt).getFullYear();
        years.add(year);
      }
    });
    // Ensure current year is always available
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices]);

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

  // Filter invoices by year
  const yearFilteredInvoices = useMemo(() =>
    activeInvoices.filter(inv => {
      const eventDate = inv.eventDate ? new Date(inv.eventDate) : new Date(inv.createdAt);
      return eventDate.getFullYear() === selectedYear;
    }),
    [activeInvoices, selectedYear]
  );

  // Get comparison year invoices
  const compareYearInvoices = useMemo(() => {
    if (!compareYear) return [];
    return activeInvoices.filter(inv => {
      const eventDate = inv.eventDate ? new Date(inv.eventDate) : new Date(inv.createdAt);
      return eventDate.getFullYear() === compareYear;
    });
  }, [activeInvoices, compareYear]);

  // Calculate stats for selected year
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const paid = yearFilteredInvoices.filter(inv => inv.status === 'paid');
    const pending = yearFilteredInvoices.filter(inv => inv.status === 'sent' || inv.status === 'draft');
    const quotations = yearFilteredInvoices.filter(inv => inv.documentType === 'quotation');
    const invoicesDocs = yearFilteredInvoices.filter(inv => inv.documentType === 'invoice');

    // Completed events (past dates with paid status)
    const completedEvents = paid.filter(inv => {
      if (!inv.eventDate) return false;
      return inv.eventDate < todayStr;
    });

    // Upcoming: Events with future dates (any status except cancelled)
    const upcomingEvents = yearFilteredInvoices.filter(inv => {
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
    const avgInvoiceValue = paid.length > 0 ? Math.round(totalRevenue / paid.length) : 0;
    const conversionRate = quotations.length > 0
      ? (invoicesDocs.length / quotations.length * 100).toFixed(0)
      : 0;

    return {
      totalRevenue,
      pendingAmount,
      avgInvoiceValue,
      totalBookings: yearFilteredInvoices.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      conversionRate,
      completedEvents: completedEvents.length,
      upcomingEvents: upcomingEvents.length,
      thisMonthEvents: thisMonthEvents.length,
    };
  }, [yearFilteredInvoices, activeInvoices]);

  // Calculate comparison year stats
  const compareStats = useMemo(() => {
    if (!compareYear || compareYearInvoices.length === 0) return null;

    const paid = compareYearInvoices.filter(inv => inv.status === 'paid');
    const totalRevenue = paid.reduce((sum, inv) => sum + inv.total, 0);
    const avgInvoiceValue = paid.length > 0 ? Math.round(totalRevenue / paid.length) : 0;

    return {
      totalRevenue,
      totalBookings: compareYearInvoices.length,
      paidCount: paid.length,
      avgInvoiceValue,
    };
  }, [compareYear, compareYearInvoices]);

  // Calculate YoY growth
  const yoyGrowth = useMemo(() => {
    if (!compareStats || compareStats.totalRevenue === 0) return null;
    const revenueGrowth = ((stats.totalRevenue - compareStats.totalRevenue) / compareStats.totalRevenue * 100).toFixed(0);
    const bookingsGrowth = compareStats.totalBookings > 0
      ? ((stats.totalBookings - compareStats.totalBookings) / compareStats.totalBookings * 100).toFixed(0)
      : '0';
    return {
      revenue: Number(revenueGrowth),
      bookings: Number(bookingsGrowth),
    };
  }, [stats, compareStats]);

  // ACTION ITEMS - Items needing attention
  const actionItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];
    const fourteenDaysFromNow = new Date(today);
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
    const fourteenDaysStr = fourteenDaysFromNow.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // Only consider active, non-cancelled invoices
    const relevantInvoices = activeInvoices.filter(inv =>
      inv.status !== 'cancelled' && inv.status !== 'paid'
    );

    // Missing phone numbers (future events)
    const missingPhone = relevantInvoices.filter(inv =>
      !inv.clientPhone && inv.eventDate && inv.eventDate >= todayStr
    );

    // Missing venue (future events)
    const missingVenue = relevantInvoices.filter(inv =>
      !inv.eventVenue && inv.eventDate && inv.eventDate >= todayStr
    );

    // No deposit paid (invoices only, future events)
    const noDeposit = relevantInvoices.filter(inv =>
      inv.documentType === 'invoice' &&
      !inv.depositPaid &&
      inv.eventDate && inv.eventDate >= todayStr
    );

    // Balance due soon (within 7 days of event, not fully paid)
    const balanceDueSoon = activeInvoices.filter(inv => {
      if (inv.status === 'paid' || inv.status === 'cancelled') return false;
      if (!inv.eventDate) return false;
      // Event is within next 7 days
      if (inv.eventDate >= todayStr && inv.eventDate <= sevenDaysStr) {
        // Has balance remaining
        const balance = inv.total - (inv.depositPaid || 0);
        return balance > 0;
      }
      return false;
    });

    // Stale quotations (older than 7 days, not converted)
    const staleQuotations = activeInvoices.filter(inv =>
      inv.documentType === 'quotation' &&
      inv.status === 'draft' &&
      inv.createdAt && inv.createdAt < sevenDaysAgoStr
    );

    // Song confirmation due (2 weeks before event)
    const songConfirmationDue = activeInvoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      if (!inv.eventDate) return false;
      // Event is within next 14 days but more than 7 days away
      return inv.eventDate >= sevenDaysStr && inv.eventDate <= fourteenDaysStr;
    });

    // Upcoming events (next 14 days)
    const upcomingEvents = activeInvoices
      .filter(inv => {
        if (inv.status === 'cancelled') return false;
        if (!inv.eventDate) return false;
        return inv.eventDate >= todayStr && inv.eventDate <= fourteenDaysStr;
      })
      .sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || ''));

    const totalActionItems = missingPhone.length + missingVenue.length +
      noDeposit.length + balanceDueSoon.length + staleQuotations.length;

    return {
      missingPhone,
      missingVenue,
      noDeposit,
      balanceDueSoon,
      staleQuotations,
      songConfirmationDue,
      upcomingEvents,
      totalActionItems,
    };
  }, [activeInvoices]);

  // Router for navigation
  const router = useRouter();

  // Open modal with filtered invoice list
  const openInvoiceModal = (filter: string, title: string) => {
    setModalFilter(filter);
    setModalTitle(title);
    setModalOpen(true);
  };

  // Get filtered invoices for modal based on filter type
  const getModalInvoices = useMemo(() => {
    if (!modalFilter) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    switch (modalFilter) {
      case 'paid':
        return yearFilteredInvoices.filter(inv => inv.status === 'paid');
      case 'pending':
        return yearFilteredInvoices.filter(inv => inv.status === 'sent' || inv.status === 'draft');
      case 'completed':
        return yearFilteredInvoices.filter(inv => inv.status === 'paid' && inv.eventDate && inv.eventDate < todayStr);
      case 'upcoming':
        return activeInvoices.filter(inv => inv.status !== 'cancelled' && inv.eventDate && inv.eventDate >= todayStr);
      case 'draft':
        return yearFilteredInvoices.filter(inv => inv.status === 'draft');
      case 'missing-phone':
        return activeInvoices.filter(inv => !inv.clientPhone && inv.status !== 'cancelled' && inv.eventDate && inv.eventDate >= todayStr);
      case 'missing-venue':
        return activeInvoices.filter(inv => !inv.eventVenue && inv.status !== 'cancelled' && inv.eventDate && inv.eventDate >= todayStr);
      case 'no-deposit':
        return activeInvoices.filter(inv => inv.documentType === 'invoice' && !inv.depositPaid && inv.status !== 'cancelled' && inv.eventDate && inv.eventDate >= todayStr);
      case 'balance-due':
        const sevenDaysFromNow = new Date(today);
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];
        return activeInvoices.filter(inv => {
          if (inv.status === 'paid' || inv.status === 'cancelled') return false;
          if (!inv.eventDate) return false;
          if (inv.eventDate >= todayStr && inv.eventDate <= sevenDaysStr) {
            const balance = inv.total - (inv.depositPaid || 0);
            return balance > 0;
          }
          return false;
        });
      case 'stale-quotations':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
        return activeInvoices.filter(inv =>
          inv.documentType === 'quotation' && inv.status === 'draft' && inv.createdAt && inv.createdAt < sevenDaysAgoStr
        );
      case 'all':
      default:
        return yearFilteredInvoices;
    }
  }, [modalFilter, yearFilteredInvoices, activeInvoices]);

  // Monthly revenue data for charts (full year for selected year)
  const monthlyData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data: { month: string; revenue: number; count: number; compareRevenue?: number; compareCount?: number }[] = [];

    // Initialize all 12 months
    monthNames.forEach(month => {
      data.push({ month, revenue: 0, count: 0, compareRevenue: 0, compareCount: 0 });
    });

    // Aggregate selected year data
    yearFilteredInvoices
      .filter(inv => inv.status === 'paid')
      .forEach(inv => {
        const date = new Date(inv.eventDate || inv.createdAt);
        const monthIndex = date.getMonth();
        data[monthIndex].revenue += inv.total;
        data[monthIndex].count += 1;
      });

    // Aggregate comparison year data
    if (compareYear) {
      compareYearInvoices
        .filter(inv => inv.status === 'paid')
        .forEach(inv => {
          const date = new Date(inv.eventDate || inv.createdAt);
          const monthIndex = date.getMonth();
          data[monthIndex].compareRevenue = (data[monthIndex].compareRevenue || 0) + inv.total;
          data[monthIndex].compareCount = (data[monthIndex].compareCount || 0) + 1;
        });
    }

    return data;
  }, [yearFilteredInvoices, compareYearInvoices, compareYear]);

  // Status breakdown for pie chart
  const statusData = useMemo(() => {
    const draft = yearFilteredInvoices.filter(inv => inv.status === 'draft').length;
    const sent = yearFilteredInvoices.filter(inv => inv.status === 'sent').length;
    const paid = yearFilteredInvoices.filter(inv => inv.status === 'paid').length;
    const cancelled = yearFilteredInvoices.filter(inv => inv.status === 'cancelled').length;

    return [
      { name: 'Draft', value: draft, color: '#94a3b8' },
      { name: 'Sent', value: sent, color: '#f59e0b' },
      { name: 'Paid', value: paid, color: '#10b981' },
      { name: 'Cancelled', value: cancelled, color: '#ef4444' },
    ].filter(item => item.value > 0);
  }, [yearFilteredInvoices]);

  // Package performance analytics
  const packageData = useMemo(() => {
    const packageMap: { [key: string]: { count: number; revenue: number } } = {};
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899'];

    yearFilteredInvoices
      .filter(inv => inv.status === 'paid')
      .forEach(inv => {
        // Extract package name from items
        const packageItem = inv.items?.find(item =>
          item.description?.toLowerCase().includes('package') ||
          item.description?.toLowerCase().includes('entrance') ||
          item.description?.toLowerCase().includes('performance')
        );

        let packageName = 'Other';
        if (packageItem) {
          // Try to extract package type (A, B, C, Full, etc.)
          const desc = packageItem.description || '';
          if (desc.toLowerCase().includes('full') || desc.toLowerCase().includes('package c')) {
            packageName = 'Full Package';
          } else if (desc.toLowerCase().includes('package b') || desc.toLowerCase().includes('cake')) {
            packageName = 'Pkg B (Cake)';
          } else if (desc.toLowerCase().includes('package a') || desc.toLowerCase().includes('entrance')) {
            packageName = 'Pkg A (Entrance)';
          } else {
            packageName = desc.substring(0, 20);
          }
        }

        if (!packageMap[packageName]) {
          packageMap[packageName] = { count: 0, revenue: 0 };
        }
        packageMap[packageName].count += 1;
        packageMap[packageName].revenue += inv.total;
      });

    return Object.entries(packageMap)
      .map(([name, data], index) => ({
        name,
        count: data.count,
        revenue: data.revenue,
        avgValue: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [yearFilteredInvoices]);

  // Conversion funnel data
  const conversionData = useMemo(() => {
    const quotations = yearFilteredInvoices.filter(inv => inv.documentType === 'quotation').length;
    const invoicesDocs = yearFilteredInvoices.filter(inv => inv.documentType === 'invoice').length;
    const sent = yearFilteredInvoices.filter(inv => inv.status === 'sent' || inv.status === 'paid').length;
    const paid = yearFilteredInvoices.filter(inv => inv.status === 'paid').length;

    return [
      { stage: 'Quotations', count: quotations, color: '#94a3b8' },
      { stage: 'Invoices', count: invoicesDocs, color: '#f59e0b' },
      { stage: 'Sent/Confirmed', count: sent, color: '#3b82f6' },
      { stage: 'Paid', count: paid, color: '#10b981' },
    ];
  }, [yearFilteredInvoices]);

  // Lead source analytics with sub-category breakdown
  const leadSourceData = useMemo(() => {
    const sourceMap: { [key: string]: {
      count: number;
      revenue: number;
      partners: { [partner: string]: { count: number; revenue: number } };
    } } = {};

    yearFilteredInvoices.forEach(inv => {
      const source = inv.leadSource || 'Unknown';
      const partner = inv.collaborationPartner || '';
      const invoiceValue = inv.total || 0;

      if (!sourceMap[source]) {
        sourceMap[source] = { count: 0, revenue: 0, partners: {} };
      }
      sourceMap[source].count += 1;
      // Count all invoice values (not just paid) for lead source analysis
      sourceMap[source].revenue += invoiceValue;

      // Track sub-breakdown for Collaboration, Referral, and Other
      if ((source === 'Collaboration' || source === 'Referral' || source === 'Other') && partner) {
        if (!sourceMap[source].partners[partner]) {
          sourceMap[source].partners[partner] = { count: 0, revenue: 0 };
        }
        sourceMap[source].partners[partner].count += 1;
        sourceMap[source].partners[partner].revenue += invoiceValue;
      }
    });

    return Object.entries(sourceMap)
      .map(([name, data]) => {
        // Build breakdown array from partners
        const breakdown = Object.entries(data.partners)
          .map(([partnerName, partnerData]) => ({
            name: partnerName,
            count: partnerData.count,
            revenue: partnerData.revenue,
          }))
          .sort((a, b) => b.count - a.count);

        return {
          name: name || 'Unknown',
          value: data.count,
          revenue: data.revenue,
          color: LEAD_SOURCE_COLORS[name] || '#6b7280',
          breakdown: breakdown.length > 0 ? breakdown : undefined,
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [yearFilteredInvoices]);

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
        {/* Year Selector */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 border rounded-lg bg-white text-slate-800 font-medium"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Compare with:</label>
              <select
                value={compareYear || ''}
                onChange={(e) => setCompareYear(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 border rounded-lg bg-white text-slate-600"
              >
                <option value="">None</option>
                {availableYears.filter(y => y !== selectedYear).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {yoyGrowth && (
              <div className="flex items-center gap-4 ml-auto">
                <div className={`flex items-center gap-1 text-sm font-medium ${yoyGrowth.revenue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  <TrendingUp className={`w-4 h-4 ${yoyGrowth.revenue < 0 ? 'rotate-180' : ''}`} />
                  {yoyGrowth.revenue >= 0 ? '+' : ''}{yoyGrowth.revenue}% Revenue
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${yoyGrowth.bookings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  <TrendingUp className={`w-4 h-4 ${yoyGrowth.bookings < 0 ? 'rotate-180' : ''}`} />
                  {yoyGrowth.bookings >= 0 ? '+' : ''}{yoyGrowth.bookings}% Bookings
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ACTION ITEMS PANEL */}
        {actionItems.totalActionItems > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="font-semibold text-red-800">
                Action Items ({actionItems.totalActionItems})
              </h2>
              <span className="text-xs text-red-600 ml-auto">Click to view details</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {actionItems.missingPhone.length > 0 && (
                <button
                  onClick={() => openInvoiceModal('missing-phone', 'Missing Phone Numbers')}
                  className="flex items-center gap-2 bg-white hover:bg-red-50 border border-red-200 rounded-lg p-3 transition-colors text-left"
                >
                  <Phone className="w-4 h-4 text-red-500" />
                  <div>
                    <div className="text-sm font-medium text-red-700">{actionItems.missingPhone.length}</div>
                    <div className="text-xs text-red-600">No Phone</div>
                  </div>
                </button>
              )}
              {actionItems.missingVenue.length > 0 && (
                <button
                  onClick={() => openInvoiceModal('missing-venue', 'Missing Venues')}
                  className="flex items-center gap-2 bg-white hover:bg-orange-50 border border-orange-200 rounded-lg p-3 transition-colors text-left"
                >
                  <MapPin className="w-4 h-4 text-orange-500" />
                  <div>
                    <div className="text-sm font-medium text-orange-700">{actionItems.missingVenue.length}</div>
                    <div className="text-xs text-orange-600">No Venue</div>
                  </div>
                </button>
              )}
              {actionItems.noDeposit.length > 0 && (
                <button
                  onClick={() => openInvoiceModal('no-deposit', 'No Deposit Paid')}
                  className="flex items-center gap-2 bg-white hover:bg-amber-50 border border-amber-200 rounded-lg p-3 transition-colors text-left"
                >
                  <DollarSign className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="text-sm font-medium text-amber-700">{actionItems.noDeposit.length}</div>
                    <div className="text-xs text-amber-600">No Deposit</div>
                  </div>
                </button>
              )}
              {actionItems.balanceDueSoon.length > 0 && (
                <button
                  onClick={() => openInvoiceModal('balance-due', 'Balance Due Soon')}
                  className="flex items-center gap-2 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg p-3 transition-colors text-left"
                >
                  <Clock className="w-4 h-4 text-rose-500" />
                  <div>
                    <div className="text-sm font-medium text-rose-700">{actionItems.balanceDueSoon.length}</div>
                    <div className="text-xs text-rose-600">Balance Due</div>
                  </div>
                </button>
              )}
              {actionItems.staleQuotations.length > 0 && (
                <button
                  onClick={() => openInvoiceModal('stale-quotations', 'Stale Quotations')}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg p-3 transition-colors text-left"
                >
                  <FileText className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-700">{actionItems.staleQuotations.length}</div>
                    <div className="text-xs text-slate-600">Stale Quotes</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* UPCOMING EVENTS TIMELINE (Next 14 Days) */}
        {actionItems.upcomingEvents.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Upcoming Events (Next 14 Days)
              </h2>
              <span className="text-xs text-slate-500">{actionItems.upcomingEvents.length} events</span>
            </div>
            <div className="space-y-3">
              {actionItems.upcomingEvents.slice(0, 5).map((inv) => {
                const eventDate = new Date(inv.eventDate + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const balance = inv.total - (inv.depositPaid || 0);
                const isFullyPaid = inv.status === 'paid' || balance <= 0;

                return (
                  <Link
                    key={inv.invoiceNumber}
                    href={`/invoice?load=${encodeURIComponent(inv.invoiceNumber)}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 border border-slate-100 cursor-pointer"
                  >
                    {/* Days countdown */}
                    <div className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center ${
                      daysUntil <= 3 ? 'bg-red-100 text-red-700' :
                      daysUntil <= 7 ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      <span className="text-lg font-bold">{daysUntil}</span>
                      <span className="text-[10px] uppercase">days</span>
                    </div>

                    {/* Event details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 truncate">{inv.clientName || 'Unnamed'}</span>
                        {/* Missing info badges */}
                        {!inv.clientPhone && (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">
                            <Phone className="w-2.5 h-2.5" />
                          </span>
                        )}
                        {!inv.eventVenue && (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full">
                            <MapPin className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{eventDate.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                        <span>•</span>
                        <span>{inv.eventVenue || 'Venue TBC'}</span>
                      </div>
                    </div>

                    {/* Payment status */}
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-800">RM {inv.total.toLocaleString()}</div>
                      {isFullyPaid ? (
                        <span className="text-xs text-emerald-600 flex items-center gap-1 justify-end">
                          <CheckCircle className="w-3 h-3" /> Paid
                        </span>
                      ) : inv.depositPaid > 0 ? (
                        <span className="text-xs text-amber-600">Bal: RM {balance.toLocaleString()}</span>
                      ) : (
                        <span className="text-xs text-red-600">No deposit</span>
                      )}
                    </div>
                  </Link>
                );
              })}
              {actionItems.upcomingEvents.length > 5 && (
                <button
                  onClick={() => openInvoiceModal('upcoming', 'Upcoming Events')}
                  className="w-full text-center text-sm text-amber-600 hover:text-amber-700 py-2"
                >
                  View all {actionItems.upcomingEvents.length} upcoming events →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards - Row 1: Revenue & Pending */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <button
            onClick={() => openInvoiceModal('paid', `Paid Invoices (${selectedYear})`)}
            className="bg-white rounded-xl p-4 shadow-sm text-left hover:ring-2 hover:ring-emerald-300 transition-all"
          >
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
          </button>

          <button
            onClick={() => openInvoiceModal('pending', `Pending (${selectedYear})`)}
            className="bg-white rounded-xl p-4 shadow-sm text-left hover:ring-2 hover:ring-amber-300 transition-all"
          >
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
          </button>

          {/* YTD: Completed Shows */}
          <button
            onClick={() => openInvoiceModal('completed', `Completed Shows (${selectedYear})`)}
            className="bg-white rounded-xl p-4 shadow-sm text-left hover:ring-2 hover:ring-green-300 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-slate-500 text-sm">Shows Done (YTD)</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.completedEvents}</p>
            <p className="text-xs text-green-600 mt-1">Completed performances</p>
          </button>

          {/* Upcoming Shows */}
          <button
            onClick={() => openInvoiceModal('upcoming', 'Upcoming Events')}
            className="bg-white rounded-xl p-4 shadow-sm text-left hover:ring-2 hover:ring-blue-300 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-slate-500 text-sm">Upcoming</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.upcomingEvents}</p>
            <p className="text-xs text-blue-600 mt-1">{stats.thisMonthEvents} this month</p>
          </button>
        </div>

        {/* Stats Cards - Row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => openInvoiceModal('all', `All Bookings (${selectedYear})`)}
            className="bg-white rounded-xl p-4 shadow-sm text-left hover:ring-2 hover:ring-slate-300 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-slate-100 p-2 rounded-lg">
                <FileText className="w-5 h-5 text-slate-600" />
              </div>
              <span className="text-slate-500 text-sm">Total Bookings</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.totalBookings}</p>
            <p className="text-xs text-slate-600 mt-1">{selectedYear}</p>
          </button>

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

        {/* Charts Row 1 */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {/* Revenue Chart */}
          <div className="md:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Revenue {selectedYear}
                {compareYear && <span className="text-slate-400 text-sm font-normal ml-2">vs {compareYear}</span>}
              </h2>
              {compareYear && (
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-500 rounded"></span> {selectedYear}</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-slate-300 rounded"></span> {compareYear}</span>
                </div>
              )}
            </div>
            {monthlyData.some(d => d.revenue > 0 || (d.compareRevenue && d.compareRevenue > 0)) ? (
              <RevenueChart data={monthlyData} showComparison={!!compareYear} />
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400">
                No revenue data for {selectedYear}
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

        {/* Charts Row 2 - Package Analytics & Conversion */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Package Performance */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Package Performance</h2>
            {packageData.length > 0 ? (
              <>
                <PackagePieChart data={packageData} />
                <div className="mt-4 space-y-2">
                  {packageData.map((pkg) => (
                    <div key={pkg.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: pkg.color }}></span>
                        <span className="text-slate-700">{pkg.name}</span>
                      </div>
                      <div className="text-slate-600">
                        {pkg.count} bookings • RM {pkg.avgValue.toLocaleString()} avg
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                No package data for {selectedYear}
              </div>
            )}
          </div>

          {/* Conversion Funnel */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Conversion Funnel</h2>
            {conversionData.some(d => d.count > 0) ? (
              <ConversionFunnelChart data={conversionData} />
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                No conversion data for {selectedYear}
              </div>
            )}
          </div>
        </div>

        {/* Lead Sources Row */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">📊 Lead Sources</h2>
          {leadSourceData.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              <LeadSourcePieChart data={leadSourceData} />
              <div className="space-y-3">
                <p className="text-sm text-slate-600 mb-4">Where your clients are coming from:</p>
                {leadSourceData.map((source) => (
                  <div key={source.name} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }}></span>
                      <span className="text-slate-700 font-medium">{source.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-800 font-medium">{source.value}</span>
                      <span className="text-slate-400 ml-1">bookings</span>
                      {source.revenue > 0 && (
                        <span className="text-emerald-600 ml-2">• RM {source.revenue.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400">
              No lead source data for {selectedYear}. Add lead sources to your invoices to track them.
            </div>
          )}
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

          {/* Balance Due Alerts & Stale Quotations */}
          <div className="space-y-6">
            {/* Balance Due Alerts */}
            {actionItems.balanceDueSoon.length > 0 && (
              <div className="bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-rose-500" />
                  <h3 className="font-semibold text-rose-800">Balance Due Soon ({actionItems.balanceDueSoon.length})</h3>
                </div>
                <div className="space-y-2">
                  {actionItems.balanceDueSoon.map((inv) => {
                    const eventDate = new Date(inv.eventDate + 'T00:00:00');
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const balance = inv.total - (inv.depositPaid || 0);

                    return (
                      <Link
                        key={inv.invoiceNumber}
                        href={`/invoice?load=${encodeURIComponent(inv.invoiceNumber)}`}
                        className="flex items-center justify-between bg-white hover:bg-rose-50 rounded-lg p-3 border border-rose-100 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{inv.clientName}</p>
                          <p className="text-xs text-slate-500">
                            {eventDate.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })} • {daysUntil} days left
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <p className="font-bold text-rose-600">RM {balance.toLocaleString()}</p>
                          </div>
                          {inv.clientPhone && (
                            <a
                              href={`https://wa.me/${inv.clientPhone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="w-3 h-3" /> Remind
                            </a>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stale Quotations */}
            {actionItems.staleQuotations.length > 0 && (
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-slate-500" />
                  <h3 className="font-semibold text-slate-700">Stale Quotations ({actionItems.staleQuotations.length})</h3>
                  <span className="text-xs text-slate-500 ml-auto">Older than 7 days</span>
                </div>
                <div className="space-y-2">
                  {actionItems.staleQuotations.slice(0, 3).map((inv) => {
                    const createdDate = new Date(inv.createdAt);
                    const today = new Date();
                    const daysOld = Math.ceil((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <Link
                        key={inv.invoiceNumber}
                        href={`/invoice?load=${encodeURIComponent(inv.invoiceNumber)}`}
                        className="flex items-center justify-between bg-white hover:bg-slate-100 rounded-lg p-3 border border-slate-100 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{inv.clientName || 'Unnamed'}</p>
                          <p className="text-xs text-slate-500">
                            {inv.invoiceNumber} • {daysOld} days old
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {inv.clientPhone && (
                            <a
                              href={`https://wa.me/${inv.clientPhone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="w-3 h-3" /> Follow Up
                            </a>
                          )}
                          <span className="text-sm font-medium text-slate-600">RM {inv.total.toLocaleString()}</span>
                        </div>
                      </Link>
                    );
                  })}
                  {actionItems.staleQuotations.length > 3 && (
                    <button
                      onClick={() => openInvoiceModal('stale-quotations', 'Stale Quotations')}
                      className="w-full text-center text-xs text-slate-600 hover:text-slate-800 py-1"
                    >
                      View all {actionItems.staleQuotations.length} stale quotations →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Recent Activity (only if no alerts) */}
            {actionItems.balanceDueSoon.length === 0 && actionItems.staleQuotations.length === 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent Activity</h2>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {recentActivity.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No activity yet</p>
                  ) : (
                    recentActivity.slice(0, 5).map(invoice => (
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
            )}
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

      {/* Invoice List Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{modalTitle}</h2>
                <p className="text-slate-400 text-sm">{getModalInvoices.length} items</p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/invoice"
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Invoice Page
                </Link>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {getModalInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-lg">No items found</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {getModalInvoices.map((inv) => {
                    const eventDate = inv.eventDate ? new Date(inv.eventDate + 'T00:00:00') : null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const daysUntil = eventDate ? Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                    const balance = inv.total - (inv.depositPaid || 0);
                    const isFullyPaid = inv.status === 'paid' || balance <= 0;

                    return (
                      <Link
                        key={inv.invoiceNumber}
                        href={`/invoice?load=${encodeURIComponent(inv.invoiceNumber)}`}
                        className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                      >
                        {/* Days countdown or status icon */}
                        {daysUntil !== null && daysUntil >= 0 ? (
                          <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                            daysUntil <= 3 ? 'bg-red-100 text-red-700' :
                            daysUntil <= 7 ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            <span className="text-lg font-bold">{daysUntil}</span>
                            <span className="text-[10px] uppercase">days</span>
                          </div>
                        ) : (
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                            inv.status === 'paid' ? 'bg-emerald-100' :
                            inv.status === 'sent' ? 'bg-amber-100' :
                            inv.status === 'cancelled' ? 'bg-red-100' :
                            'bg-slate-100'
                          }`}>
                            <StatusIcon status={inv.status} />
                          </div>
                        )}

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              inv.documentType === 'quotation' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {inv.documentType === 'quotation' ? 'QUO' : 'INV'}
                            </span>
                            <span className="font-semibold text-slate-800">{inv.clientName || 'Unnamed'}</span>
                            <span className="text-xs text-slate-400">{inv.invoiceNumber}</span>
                            {/* Missing info badges */}
                            {!inv.clientPhone && (
                              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">
                                <Phone className="w-2.5 h-2.5" /> No phone
                              </span>
                            )}
                            {!inv.eventVenue && (
                              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full">
                                <MapPin className="w-2.5 h-2.5" /> No venue
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                            {eventDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {eventDate.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                            {inv.eventVenue && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[200px]">{inv.eventVenue}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Amount & actions */}
                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold text-slate-800">RM {inv.total.toLocaleString()}</div>
                          {isFullyPaid ? (
                            <span className="text-xs text-emerald-600 flex items-center gap-1 justify-end">
                              <CheckCircle className="w-3 h-3" /> Paid
                            </span>
                          ) : inv.depositPaid > 0 ? (
                            <span className="text-xs text-amber-600">Balance: RM {balance.toLocaleString()}</span>
                          ) : inv.documentType === 'invoice' ? (
                            <span className="text-xs text-red-600">No deposit</span>
                          ) : (
                            <span className={`text-xs capitalize ${
                              inv.status === 'sent' ? 'text-blue-600' : 'text-slate-500'
                            }`}>{inv.status}</span>
                          )}
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {inv.clientPhone && (
                            <a
                              href={`https://wa.me/${inv.clientPhone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                              title="WhatsApp"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                          <span
                            className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors"
                            title="Open in Invoice Generator"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Total: RM {getModalInvoices.reduce((sum, inv) => sum + inv.total, 0).toLocaleString()}
              </p>
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
