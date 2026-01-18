'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Printer, ArrowLeft, Plus, Trash2, Lock, Eye, EyeOff, Percent, Save, History, X, FileText, Calendar, ChevronRight, Cloud, CloudOff, RefreshCw, MessageCircle, Send, Receipt, CheckCircle, ExternalLink, Settings, LayoutDashboard, Home, Search, ChevronLeft, ArrowUpDown, Phone, MapPin, DollarSign, AlertCircle, Download } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { siteConfig, getPhoneDisplay } from '@/config/site.config';
import { isAuthenticated as checkAuth, login as doLogin } from '@/lib/auth';
import { useCloudConfig } from '@/lib/cloud-config';
import {
  saveInvoiceToGoogle,
  createCalendarEvent,
  syncAllInvoices,
  isGoogleSyncEnabled,
  fetchInvoicesFromCloud,
  fetchLatestInvoiceNumber,
  migrateInvoiceStatus,
  type StoredInvoice as GoogleStoredInvoice,
  type SyncStatus,
} from '@/lib/google-sync';
import {
  generateQuotationMessage,
  generateConfirmationMessage,
  generateBalanceReminderMessage,
  generateSongConfirmationMessage,
  generateThankYouMessage,
  openWhatsAppWithMessage,
  messageTemplates,
  type MessageTemplateId,
} from '@/lib/whatsapp-templates';

// Password is now managed by shared auth module (@/lib/auth)

// Storage key for localStorage (derived from business name)
const STORAGE_KEY = 'studio_invoices';

// Google Sheet URL for viewing inquiries (optional)
const GOOGLE_SHEET_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL || '';

interface InvoiceItem {
  id: string;
  description: string;
  details: string;
  quantity: number;
  rate: number;
}

type LeadSource = 'Web' | 'Instagram' | 'WhatsApp' | 'TikTok' | 'Referral' | 'Collaboration' | 'Other' | '';

// Enhanced status system for accurate workflow tracking
type InvoiceStatus =
  | 'quotation_draft'    // Initial quote created
  | 'quotation_sent'     // Quote sent to client
  | 'deposit_received'   // Deposit paid, booking confirmed
  | 'invoice_sent'       // Invoice sent after deposit
  | 'balance_paid'       // Full payment received
  | 'completed'          // Event performed
  | 'archived'           // Feedback collected, case closed
  | 'cancelled'          // Cancelled at any stage
  // Legacy statuses for backward compatibility
  | 'draft' | 'sent' | 'paid';

type PaymentStatus = 'none' | 'deposit' | 'partial' | 'full';
type FeedbackStatus = 'pending' | 'requested' | 'received' | 'reviewed';

interface StoredInvoice {
  id: string;
  invoiceNumber: string;
  documentType: 'quotation' | 'invoice';
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  eventType: string;
  eventDate: string;
  eventTimeHour: string;
  eventTimeMinute: string;
  eventTimePeriod: string;
  eventVenue: string;
  items: InvoiceItem[];
  discount: number;
  discountType: 'amount' | 'percent';
  depositRequested?: number; // Deposit amount requested on quotation
  depositPaid: number;       // Actual deposit received (on invoice)
  total: number;
  createdAt: string;
  status: InvoiceStatus;
  linkedQuotationNumber?: string; // Original quotation number when converted to invoice
  linkedQuotation?: string; // Same field but from Google Sheets (column header "Linked Quotation")
  convertedAt?: string; // When quotation was converted to invoice
  deletedAt?: string; // Soft delete timestamp
  leadSource?: LeadSource;
  collaborationPartner?: string;

  // NEW: Payment tracking
  paymentStatus?: PaymentStatus;
  depositReceivedDate?: string;
  balanceReceivedDate?: string;

  // NEW: Lifecycle tracking
  calendarEventId?: string;
  calendarCreated?: boolean;
  invoiceSentDate?: string;
  receiptSentDate?: string;
  eventCompletedDate?: string;
  feedbackStatus?: FeedbackStatus;
}

function InvoiceGeneratorContent() {
  // URL params for auto-loading specific invoice
  const searchParams = useSearchParams();
  const loadInvoiceNumber = searchParams.get('load');
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);

  // Password state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Prevent flash
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Cloud config for packages/addons (fetched from Google Sheets)
  const { packages: cloudPackages, addons: cloudAddons, isLoading: configLoading, refresh: refreshConfig } = useCloudConfig();

  // History panel
  const [showHistory, setShowHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'all' | 'drafts' | 'sent' | 'deposit' | 'paid' | 'completed' | 'deleted'>('all');
  const [savedInvoices, setSavedInvoices] = useState<StoredInvoice[]>([]);

  // History filters - default to current year
  const [historyYear, setHistoryYear] = useState<number | 'all'>(new Date().getFullYear());
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Get available years from invoices
  const availableYears = Array.from(new Set(
    savedInvoices
      .map(inv => inv.eventDate ? new Date(inv.eventDate).getFullYear() : null)
      .filter((y): y is number => y !== null)
  )).sort((a, b) => b - a);

  // Filter and sort invoices for display
  const sortInvoices = (a: StoredInvoice, b: StoredInvoice) => {
    switch (historySort) {
      case 'date-asc':
        return new Date(a.eventDate || a.createdAt).getTime() - new Date(b.eventDate || b.createdAt).getTime();
      case 'amount-desc':
        return b.total - a.total;
      case 'amount-asc':
        return a.total - b.total;
      case 'date-desc':
      default:
        return new Date(b.eventDate || b.createdAt).getTime() - new Date(a.eventDate || a.createdAt).getTime();
    }
  };

  // Get quotation numbers that have been converted to invoices
  // These should be hidden from history to avoid confusion
  // Note: Google Sheets uses "linkedQuotation" (from header "Linked Quotation")
  // while localStorage uses "linkedQuotationNumber" - check both
  const invoicesWithLinkedQuotation = savedInvoices.filter(
    inv => inv.documentType === 'invoice' && (inv.linkedQuotationNumber || inv.linkedQuotation)
  );


  const convertedQuotationNumbers = new Set(
    invoicesWithLinkedQuotation
      .map(inv => inv.linkedQuotationNumber || inv.linkedQuotation)
      .filter((num): num is string => !!num)
  );


  // Apply all filters - exclude quotations that have been converted to invoices
  const activeInvoices = savedInvoices.filter(inv => {
    if (inv.deletedAt) return false;
    // Hide quotations that have been converted to invoices
    if (inv.documentType === 'quotation' && convertedQuotationNumbers.has(inv.invoiceNumber)) {
      return false;
    }
    return true;
  });
  const deletedInvoices = savedInvoices.filter(inv => inv.deletedAt);

  // Helper to filter by year
  const filterByYear = (invoices: StoredInvoice[]) => {
    if (historyYear === 'all') return invoices;
    return invoices.filter(inv => {
      const invYear = inv.eventDate ? new Date(inv.eventDate).getFullYear() : null;
      return invYear === historyYear;
    });
  };

  // Year-filtered invoices for counts
  const yearFilteredActive = filterByYear(activeInvoices);
  const yearFilteredDeleted = filterByYear(deletedInvoices);

  // Helper: check status categories (handles both legacy and new statuses)
  // Defined here before usage in filtering
  const isDraftStatus = (status: InvoiceStatus) =>
    status === 'draft' || status === 'quotation_draft';
  const isSentStatus = (status: InvoiceStatus) =>
    status === 'sent' || status === 'quotation_sent' || status === 'invoice_sent';
  const isDepositReceivedStatus = (status: InvoiceStatus) =>
    status === 'deposit_received';
  const isPaidStatus = (status: InvoiceStatus) =>
    status === 'paid' || status === 'deposit_received' || status === 'balance_paid';
  const isCompletedStatus = (status: InvoiceStatus) =>
    status === 'completed' || status === 'archived';
  const isFullyPaidStatus = (status: InvoiceStatus) =>
    status === 'paid' || status === 'balance_paid';

  const filteredInvoices = (historyTab === 'deleted' ? yearFilteredDeleted : yearFilteredActive)
    .filter(inv => {
      // Status filter (for non-deleted) - use helper functions for new status system
      if (historyTab !== 'deleted' && historyTab !== 'all') {
        if (historyTab === 'drafts' && !isDraftStatus(inv.status)) return false;
        if (historyTab === 'sent' && !isSentStatus(inv.status)) return false;
        if (historyTab === 'deposit' && !isDepositReceivedStatus(inv.status)) return false;
        if (historyTab === 'paid' && !isFullyPaidStatus(inv.status)) return false;
        if (historyTab === 'completed' && !isCompletedStatus(inv.status)) return false;
      }
      // Search filter
      if (historySearch) {
        const search = historySearch.toLowerCase();
        return (
          inv.clientName?.toLowerCase().includes(search) ||
          inv.invoiceNumber?.toLowerCase().includes(search) ||
          inv.eventVenue?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .sort(sortInvoices);

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = filteredInvoices.slice(
    (historyPage - 1) * ITEMS_PER_PAGE,
    historyPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  const resetHistoryPage = () => setHistoryPage(1);

  // Status counts for tabs - RESPECT YEAR FILTER (handles legacy + new statuses)
  const statusCounts = {
    all: yearFilteredActive.length,
    drafts: yearFilteredActive.filter(inv => isDraftStatus(inv.status)).length,
    sent: yearFilteredActive.filter(inv => isSentStatus(inv.status)).length,
    deposit: yearFilteredActive.filter(inv => isDepositReceivedStatus(inv.status)).length,
    paid: yearFilteredActive.filter(inv => isFullyPaidStatus(inv.status)).length,
    completed: yearFilteredActive.filter(inv => isCompletedStatus(inv.status)).length,
    deleted: yearFilteredDeleted.length,
  };

  // Summary stats (based on year filter, before status/search filter)
  const summaryStats = {
    total: yearFilteredActive.length,
    totalValue: yearFilteredActive.reduce((sum, inv) => sum + inv.total, 0),
    collected: yearFilteredActive.filter(inv => isFullyPaidStatus(inv.status)).reduce((sum, inv) => sum + inv.total, 0),
    pending: yearFilteredActive.filter(inv => !isFullyPaidStatus(inv.status) && inv.status !== 'cancelled').reduce((sum, inv) => sum + inv.total, 0),
    deposits: yearFilteredActive.reduce((sum, inv) => sum + (inv.depositPaid || 0), 0),
  };

  // Legacy: visibleInvoices for compatibility
  const visibleInvoices = paginatedInvoices;

  // Track currently loaded invoice for updates
  const [currentLoadedId, setCurrentLoadedId] = useState<string | null>(null);
  const [linkedQuotationNumber, setLinkedQuotationNumber] = useState<string | null>(null);

  // Cloud sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Check if already authenticated (shared auth)
  useEffect(() => {
    if (checkAuth()) {
      setIsAuthenticated(true);
    }
    setIsLoading(false); // Done checking
  }, []);

  // Track latest invoice numbers from cloud
  const [latestNumbers, setLatestNumbers] = useState<{
    nextQuotation: string;
    nextInvoice: string;
  } | null>(null);

  // Load invoices: fetch from cloud first, fallback to localStorage
  useEffect(() => {
    const loadInvoices = async () => {
      if (!isInitialLoad) return;

      // First, load from localStorage as immediate cache
      const stored = localStorage.getItem(STORAGE_KEY);
      const rawLocalInvoices: StoredInvoice[] = stored ? JSON.parse(stored) : [];

      // Apply migration to convert legacy statuses
      const localInvoices = rawLocalInvoices.map(inv =>
        migrateInvoiceStatus(inv as GoogleStoredInvoice) as StoredInvoice
      );

      if (localInvoices.length > 0) {
        setSavedInvoices(localInvoices);
        // Save migrated invoices back to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localInvoices));
      }

      // Then try to fetch from cloud
      if (isGoogleSyncEnabled()) {
        setSyncStatus('syncing');

        try {
          // Fetch invoices and latest number in parallel
          const [invoicesResult, numbersResult] = await Promise.all([
            fetchInvoicesFromCloud(),
            fetchLatestInvoiceNumber(),
          ]);

          // Handle invoices - smart merge respecting deletedAt
          if (invoicesResult.success && invoicesResult.invoices.length > 0) {
            const cloudInvoices = invoicesResult.invoices as StoredInvoice[];

            // Build lookup maps
            const cloudMap = new Map(cloudInvoices.map(inv => [inv.invoiceNumber, inv]));
            const localMap = new Map(localInvoices.map(inv => [inv.invoiceNumber, inv]));

            // Merge logic: for each invoice, decide which version to keep
            const mergedMap = new Map<string, StoredInvoice>();

            // Add all cloud invoices first
            for (const cloud of cloudInvoices) {
              const local = localMap.get(cloud.invoiceNumber);
              if (local) {
                // Both exist - merge with preference for more recent deletedAt/status
                if (local.deletedAt && !cloud.deletedAt) {
                  // Local was deleted but cloud wasn't - keep local deletion
                  mergedMap.set(cloud.invoiceNumber, local);
                } else if (cloud.deletedAt && !local.deletedAt) {
                  // Cloud was deleted but local wasn't - keep cloud deletion
                  mergedMap.set(cloud.invoiceNumber, cloud);
                } else {
                  // Both have same deletion state - prefer cloud (source of truth)
                  // But preserve local deletedAt if it exists
                  mergedMap.set(cloud.invoiceNumber, {
                    ...cloud,
                    deletedAt: cloud.deletedAt || local.deletedAt,
                  });
                }
              } else {
                // Only in cloud
                mergedMap.set(cloud.invoiceNumber, cloud);
              }
            }

            // Add local-only invoices (not in cloud)
            for (const local of localInvoices) {
              if (!cloudMap.has(local.invoiceNumber)) {
                mergedMap.set(local.invoiceNumber, local);
              }
            }

            const mergedInvoices = Array.from(mergedMap.values());
            setSavedInvoices(mergedInvoices);

            // Update localStorage with merged data
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedInvoices));

            console.log('[Sync] Merged invoices:', {
              cloud: cloudInvoices.length,
              local: localInvoices.length,
              merged: mergedInvoices.length,
              active: mergedInvoices.filter(inv => !inv.deletedAt).length,
              deleted: mergedInvoices.filter(inv => inv.deletedAt).length,
            });
          } else if (invoicesResult.success && invoicesResult.invoices.length === 0) {
            // Cloud is empty, push local to cloud
            if (localInvoices.length > 0) {
              await syncAllInvoices(localInvoices as GoogleStoredInvoice[]);
            }
          }

          // Handle invoice numbers
          if (numbersResult.success) {
            setLatestNumbers({
              nextQuotation: numbersResult.nextQuotation,
              nextInvoice: numbersResult.nextInvoice,
            });
            // Set the invoice number to the next available quotation number
            setInvoiceNumber(numbersResult.nextQuotation);
            console.log('[InvoiceNumber] Set to:', numbersResult.nextQuotation);
          }

          setSyncStatus('synced');
          setLastSyncTime(new Date());
        } catch (error) {
          console.error('Error loading from cloud:', error);
          setSyncStatus('offline');
        }
      } else {
        // No cloud sync configured
        setSyncStatus('idle');
      }

      setIsInitialLoad(false);
    };

    loadInvoices();
  }, [isInitialLoad]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (doLogin(password)) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  // Document type
  const [documentType, setDocumentType] = useState<'quotation' | 'invoice'>('quotation');
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<StoredInvoice['status']>('quotation_draft');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('none');
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('pending');
  const [calendarCreated, setCalendarCreated] = useState(false);
  const [calendarEventId, setCalendarEventId] = useState<string | undefined>();
  const [depositReceivedDate, setDepositReceivedDate] = useState<string | undefined>();
  const [balanceReceivedDate, setBalanceReceivedDate] = useState<string | undefined>();
  const [invoiceSentDate, setInvoiceSentDate] = useState<string | undefined>();
  const [receiptSentDate, setReceiptSentDate] = useState<string | undefined>();
  const [eventCompletedDate, setEventCompletedDate] = useState<string | undefined>();

  // Invoice details
  const [invoiceNumber, setInvoiceNumber] = useState(`QUO-${new Date().getFullYear()}-001`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);

  // Update number prefix when type changes
  const updateDocumentNumber = async (type: 'quotation' | 'invoice') => {
    // If we have latestNumbers from cloud, use them
    if (latestNumbers) {
      const nextNumber = type === 'quotation' ? latestNumbers.nextQuotation : latestNumbers.nextInvoice;
      setInvoiceNumber(nextNumber);
    } else {
      // Fallback: just change the prefix
      const prefix = type === 'quotation' ? 'QUO' : 'INV';
      const currentNum = invoiceNumber.split('-').pop() || '001';
      setInvoiceNumber(`${prefix}-${new Date().getFullYear()}-${currentNum}`);
    }
    setDocumentType(type);
  };

  // Client details
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  // Lead source tracking
  const [leadSource, setLeadSource] = useState<'Web' | 'Instagram' | 'WhatsApp' | 'TikTok' | 'Referral' | 'Collaboration' | 'Other' | ''>('');
  const [collaborationPartner, setCollaborationPartner] = useState('');

  // Smart save - track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [lastSavedState, setLastSavedState] = useState<string>('');

  // Event details
  const [eventType, setEventType] = useState('Wedding Reception');
  const [eventDate, setEventDate] = useState('');
  const [eventTimeHour, setEventTimeHour] = useState('7');
  const [eventTimeMinute, setEventTimeMinute] = useState('00');
  const [eventTimePeriod, setEventTimePeriod] = useState('PM');
  const [eventVenue, setEventVenue] = useState('');

  // Line items
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Payment
  const [depositRequested, setDepositRequested] = useState(0); // For quotations
  const [depositPaid, setDepositPaid] = useState(0);           // For invoices
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const discountAmount = discountType === 'percent' ? (subtotal * discount / 100) : discount;
  const totalAfterDiscount = subtotal - discountAmount;
  const balanceDue = totalAfterDiscount - depositPaid;

  // Track unsaved changes by comparing current state to last saved state
  const currentFormState = JSON.stringify({
    clientName, clientPhone, clientEmail, clientAddress,
    eventType, eventDate, eventTimeHour, eventTimeMinute, eventTimePeriod, eventVenue,
    items, discount, discountType, depositRequested, depositPaid, leadSource, collaborationPartner,
  });

  // Track unsaved changes - compare current form to last saved state
  useEffect(() => {
    // For new invoices (no loaded ID), any data means unsaved changes
    if (!currentLoadedId && lastSavedState === '') {
      // New invoice - check if any meaningful data has been entered
      const hasData = Boolean(clientName) || Boolean(eventDate) || items.length > 0;
      setHasUnsavedChanges(hasData);
    } else if (lastSavedState !== '') {
      // Loaded or previously saved - compare to last state
      setHasUnsavedChanges(currentFormState !== lastSavedState);
    }
  }, [currentFormState, lastSavedState, currentLoadedId, clientName, eventDate, items.length]);

  // Format time for display
  const formattedTime = `${eventTimeHour}:${eventTimeMinute} ${eventTimePeriod}`;

  // Add item
  const addItem = (preset?: { description: string; details: string; rate: number }) => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: preset?.description || '',
      details: preset?.details || '',
      quantity: 1,
      rate: preset?.rate || 0,
    };
    setItems([...items, newItem]);
  };

  // Remove item
  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // Update item
  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // Calculate balance due date (X days before event from config)
  const getBalanceDueDate = () => {
    if (!eventDate) return null;
    const event = new Date(eventDate);
    event.setDate(event.getDate() - siteConfig.terms.balanceDueDays);
    return event;
  };

  const balanceDueDate = getBalanceDueDate();
  const formattedBalanceDueDate = balanceDueDate
    ? balanceDueDate.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : `${siteConfig.terms.balanceDueDays} days before event`;

  // Helper to extract date only from ISO timestamp
  const extractDateOnly = (dateStr: string): string => {
    if (!dateStr) return 'TBC';
    // Handle ISO format: 2026-03-07T16:00:00.000Z -> 2026-03-07
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    return dateStr;
  };

  // Generate filename for PDF (uses only event date - no time)
  const generateFilename = () => {
    // Use event date only, extract from ISO if needed
    const dateStr = extractDateOnly(eventDate);
    const cleanClientName = (clientName || 'Client').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 30);
    return `${dateStr}-${cleanClientName}-${invoiceNumber}`;
  };

  // Update document title dynamically for PDF filename
  useEffect(() => {
    if (isAuthenticated && (clientName || eventDate || invoiceNumber)) {
      document.title = generateFilename();
    }
    return () => {
      document.title = siteConfig.business.name;
    };
  }, [clientName, eventDate, invoiceNumber, documentType, isAuthenticated]);

  // Print handler
  const handlePrint = () => {
    // Ensure title is set before printing
    document.title = generateFilename();
    // Small delay to ensure title is set
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Print receipt
  const handlePrintReceipt = () => {
    setShowReceipt(true);
    setTimeout(() => {
      document.title = `${generateFilename()}-RECEIPT`;
      window.print();
      setShowReceipt(false);
    }, 100);
  };

  // Generate filename from specific invoice data (for downloading from history)
  const generateFilenameForInvoice = (inv: StoredInvoice) => {
    const dateStr = extractDateOnly(inv.eventDate);
    const cleanClientName = (inv.clientName || 'Client').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 30);
    return `${dateStr}-${cleanClientName}-${inv.invoiceNumber}`;
  };

  // Download PDF directly (no print dialog)
  const handleDownloadPDF = async (overrideInvoice?: StoredInvoice) => {
    const element = document.getElementById('invoice-preview');
    if (!element) return;

    // Dynamically import html2pdf.js (client-side only)
    const html2pdf = (await import('html2pdf.js')).default;

    // Use override invoice filename if provided, otherwise use current form
    const filename = overrideInvoice
      ? `${generateFilenameForInvoice(overrideInvoice)}.pdf`
      : `${generateFilename()}.pdf`;

    // Clone the element and prepare for PDF
    const clone = element.cloneNode(true) as HTMLElement;

    // Remove elements meant to be hidden in print (they have print:hidden class)
    // Use attribute selector approach since class names are complex
    clone.querySelectorAll('[class*="print:hidden"]').forEach(el => el.remove());

    // Show elements that should only appear in print (they have hidden print:block)
    clone.querySelectorAll('[class*="print:block"]').forEach(el => {
      (el as HTMLElement).style.display = 'block';
      (el as HTMLElement).classList.remove('hidden');
    });

    // Also show print:inline elements
    clone.querySelectorAll('[class*="print:inline"]').forEach(el => {
      (el as HTMLElement).style.display = 'inline';
      (el as HTMLElement).classList.remove('hidden');
    });

    const opt = {
      margin: [0, 8, 8, 8],
      filename: filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 1.2,
        useCORS: true,
        letterRendering: true,
        windowWidth: 900,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    html2pdf().set(opt).from(clone).save();
  };

  // Download receipt PDF directly
  const handleDownloadReceiptPDF = async () => {
    setShowReceipt(true);
    // Wait for receipt to render
    await new Promise(resolve => setTimeout(resolve, 100));

    const element = document.getElementById('receipt-preview');
    if (!element) {
      setShowReceipt(false);
      return;
    }

    const html2pdf = (await import('html2pdf.js')).default;

    const filename = `${generateFilename()}-RECEIPT.pdf`;
    const opt = {
      margin: [5, 5, 5, 5],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' },
    };

    html2pdf().set(opt).from(element).save();
    setShowReceipt(false);
  };

  // Save invoice to localStorage
  const saveInvoice = (status: StoredInvoice['status'] = 'draft') => {
    // Check if updating existing by ID or creating new
    const existingIndex = currentLoadedId
      ? savedInvoices.findIndex(inv => inv.id === currentLoadedId)
      : savedInvoices.findIndex(inv => inv.invoiceNumber === invoiceNumber);

    // Preserve original createdAt if updating existing
    const existingInvoice = existingIndex >= 0 ? savedInvoices[existingIndex] : null;

    const invoice: StoredInvoice = {
      id: currentLoadedId || Date.now().toString(),
      invoiceNumber,
      documentType,
      clientName,
      clientPhone,
      clientEmail,
      clientAddress,
      eventType,
      eventDate,
      eventTimeHour,
      eventTimeMinute,
      eventTimePeriod,
      eventVenue,
      items,
      discount,
      discountType,
      depositRequested: documentType === 'quotation' ? (depositRequested || undefined) : undefined,
      depositPaid,
      total: totalAfterDiscount,
      createdAt: existingInvoice?.createdAt || new Date().toISOString(),
      status,
      linkedQuotationNumber: linkedQuotationNumber || undefined,
      convertedAt: existingInvoice?.convertedAt || (linkedQuotationNumber ? new Date().toISOString() : undefined),
      leadSource: leadSource || undefined,
      collaborationPartner: ['Collaboration', 'Referral', 'Other'].includes(leadSource) ? collaborationPartner : undefined,
      // New tracking fields
      paymentStatus: paymentStatus || 'none',
      depositReceivedDate: depositReceivedDate,
      balanceReceivedDate: balanceReceivedDate,
      calendarEventId: calendarEventId,
      calendarCreated: calendarCreated,
      invoiceSentDate: invoiceSentDate,
      receiptSentDate: receiptSentDate,
      eventCompletedDate: eventCompletedDate,
      feedbackStatus: feedbackStatus || 'pending',
    };

    let updatedInvoices: StoredInvoice[];

    if (existingIndex >= 0) {
      updatedInvoices = [...savedInvoices];
      updatedInvoices[existingIndex] = invoice;
    } else {
      updatedInvoices = [invoice, ...savedInvoices];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedInvoices));
    setSavedInvoices(updatedInvoices);

    // Reset current loaded ID after saving
    setCurrentLoadedId(invoice.id);

    // Sync to Google Sheets (if configured)
    if (isGoogleSyncEnabled()) {
      setSyncStatus('syncing');
      saveInvoiceToGoogle(invoice as GoogleStoredInvoice)
        .then((result) => {
          if (result.success) {
            setSyncStatus('synced');
            setLastSyncTime(new Date());
            console.log('Synced to Google Sheets');
          } else {
            setSyncStatus('error');
            console.error('Google sync failed:', result.error);
          }
        })
        .catch((err) => {
          setSyncStatus('error');
          console.error('Google sync failed:', err);
        });
    }

    // Update last saved state for change tracking (no popup alert)
    setLastSavedState(JSON.stringify({
      clientName, clientPhone, clientEmail, clientAddress,
      eventType, eventDate, eventTimeHour, eventTimeMinute, eventTimePeriod, eventVenue,
      items, discount, discountType, depositRequested, depositPaid, leadSource, collaborationPartner,
    }));
    setHasUnsavedChanges(false);

    // Show "Saved!" animation briefly
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);

    // Invalidate latest numbers so next "New" gets fresh numbers
    setLatestNumbers(null);
  };

  // Convert quotation to invoice (uses next available invoice number, not naive rename)
  // This is typically triggered when deposit is received
  const convertToInvoice = async () => {
    if (documentType !== 'quotation') return;

    const originalQuoNumber = invoiceNumber;

    // Get the next available invoice number (NOT just renaming QUO to INV)
    let newInvoiceNumber: string;

    if (latestNumbers?.nextInvoice) {
      // Use cached latest numbers
      newInvoiceNumber = latestNumbers.nextInvoice;
    } else if (isGoogleSyncEnabled()) {
      // Fetch fresh from Google Sheets
      const result = await fetchLatestInvoiceNumber();
      if (result.success) {
        newInvoiceNumber = result.nextInvoice;
        setLatestNumbers({
          nextQuotation: result.nextQuotation,
          nextInvoice: result.nextInvoice,
        });
      } else {
        // Fallback: calculate from local data
        newInvoiceNumber = getNextLocalInvoiceNumber();
      }
    } else {
      // Fallback: calculate from local data
      newInvoiceNumber = getNextLocalInvoiceNumber();
    }

    setLinkedQuotationNumber(originalQuoNumber);
    setInvoiceNumber(newInvoiceNumber);
    setDocumentType('invoice');
    setInvoiceDate(new Date().toISOString().split('T')[0]);

    // Auto-set deposit as paid (use depositRequested if set, otherwise calculate from percentage)
    const deposit = depositRequested > 0
      ? depositRequested
      : Math.round(totalAfterDiscount * (siteConfig.terms.depositPercent / 100));
    setDepositPaid(deposit);

    // Update status and payment tracking (conversion means deposit received)
    setCurrentStatus('deposit_received');
    setPaymentStatus('deposit');
    if (!depositReceivedDate) {
      setDepositReceivedDate(new Date().toISOString().split('T')[0]);
    }
  };

  // Helper: Get next invoice number from local data
  const getNextLocalInvoiceNumber = (): string => {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const existingNumbers = savedInvoices
      .filter(inv => inv.invoiceNumber.startsWith(prefix) && !inv.deletedAt)
      .map(inv => parseInt(inv.invoiceNumber.split('-').pop() || '0'));
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  };

  // Start new document (clear form)
  const startNew = async () => {
    // Try to get latest number from cloud
    let nextNumber = latestNumbers?.nextQuotation;

    if (!nextNumber && isGoogleSyncEnabled()) {
      // Fetch fresh if not cached
      const result = await fetchLatestInvoiceNumber();
      if (result.success) {
        nextNumber = result.nextQuotation;
        setLatestNumbers({
          nextQuotation: result.nextQuotation,
          nextInvoice: result.nextInvoice,
        });
      }
    }

    if (!nextNumber) {
      // Fallback to local calculation
      const prefix = 'QUO';
      const existingNumbers = savedInvoices
        .filter(inv => inv.invoiceNumber.startsWith(prefix))
        .map(inv => parseInt(inv.invoiceNumber.split('-').pop() || '0'));
      const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      nextNumber = `${prefix}-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;
    }

    setDocumentType('quotation');
    setInvoiceNumber(nextNumber);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setCurrentStatus('quotation_draft');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientAddress('');
    setEventType('Wedding Reception');
    setEventDate('');
    setEventTimeHour('7');
    setEventTimeMinute('00');
    setEventTimePeriod('PM');
    setEventVenue('');
    setItems([]);
    setDiscount(0);
    setDiscountType('amount');
    setDepositRequested(0);
    setDepositPaid(0);
    setCurrentLoadedId(null);
    setLinkedQuotationNumber(null);
    setLeadSource('');
    setCollaborationPartner('');
    // Reset new tracking fields
    setPaymentStatus('none');
    setFeedbackStatus('pending');
    setCalendarCreated(false);
    setCalendarEventId(undefined);
    setDepositReceivedDate(undefined);
    setBalanceReceivedDate(undefined);
    setInvoiceSentDate(undefined);
    setReceiptSentDate(undefined);
    setEventCompletedDate(undefined);
  };

  // Load invoice from history
  const loadInvoice = useCallback((invoice: StoredInvoice) => {
    setCurrentLoadedId(invoice.id);
    // Handle both field names (localStorage uses linkedQuotationNumber, Google Sheets uses linkedQuotation)
    setLinkedQuotationNumber(invoice.linkedQuotationNumber || invoice.linkedQuotation || null);
    setDocumentType(invoice.documentType);
    setInvoiceNumber(invoice.invoiceNumber);
    setCurrentStatus(invoice.status);
    // Set invoice date from createdAt (the document creation date)
    const createdDate = invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    setInvoiceDate(createdDate);
    setClientName(invoice.clientName);
    setClientPhone(invoice.clientPhone);
    setClientEmail(invoice.clientEmail);
    setClientAddress(invoice.clientAddress);
    setEventType(invoice.eventType);
    setEventDate(invoice.eventDate);
    setEventTimeHour(invoice.eventTimeHour);
    setEventTimeMinute(invoice.eventTimeMinute);
    setEventTimePeriod(invoice.eventTimePeriod);
    setEventVenue(invoice.eventVenue);
    setItems(invoice.items);
    setDiscount(invoice.discount);
    setDiscountType(invoice.discountType);
    setDepositRequested(invoice.depositRequested || 0);
    setDepositPaid(invoice.depositPaid);
    setLeadSource(invoice.leadSource || '');
    setCollaborationPartner(invoice.collaborationPartner || '');
    setShowHistory(false);

    // Load new tracking fields
    setPaymentStatus(invoice.paymentStatus || 'none');
    setFeedbackStatus(invoice.feedbackStatus || 'pending');
    setCalendarCreated(invoice.calendarCreated || false);
    setCalendarEventId(invoice.calendarEventId);
    setDepositReceivedDate(invoice.depositReceivedDate);
    setBalanceReceivedDate(invoice.balanceReceivedDate);
    setInvoiceSentDate(invoice.invoiceSentDate);
    setReceiptSentDate(invoice.receiptSentDate);
    setEventCompletedDate(invoice.eventCompletedDate);

    // Set last saved state for change tracking
    setLastSavedState(JSON.stringify({
      clientName: invoice.clientName, clientPhone: invoice.clientPhone,
      clientEmail: invoice.clientEmail, clientAddress: invoice.clientAddress,
      eventType: invoice.eventType, eventDate: invoice.eventDate,
      eventTimeHour: invoice.eventTimeHour, eventTimeMinute: invoice.eventTimeMinute,
      eventTimePeriod: invoice.eventTimePeriod, eventVenue: invoice.eventVenue,
      items: invoice.items, discount: invoice.discount, discountType: invoice.discountType,
      depositRequested: invoice.depositRequested || 0,
      depositPaid: invoice.depositPaid, leadSource: invoice.leadSource || '',
      collaborationPartner: invoice.collaborationPartner || '',
      paymentStatus: invoice.paymentStatus || 'none',
      feedbackStatus: invoice.feedbackStatus || 'pending',
    }));
    setHasUnsavedChanges(false);
  }, []);

  // Auto-load invoice from URL param (e.g., /invoice?load=INV-2026-001)
  useEffect(() => {
    if (loadInvoiceNumber && savedInvoices.length > 0 && !hasAutoLoaded) {
      const invoiceToLoad = savedInvoices.find(inv => inv.invoiceNumber === loadInvoiceNumber);
      if (invoiceToLoad) {
        loadInvoice(invoiceToLoad);
        setHasAutoLoaded(true);
      }
    }
  }, [loadInvoiceNumber, savedInvoices, hasAutoLoaded, loadInvoice]);

  // Delete invoice from history - uses invoiceNumber as unique identifier
  const deleteInvoice = (invoiceNumber: string) => {
    const targetInvoice = savedInvoices.find(inv => inv.invoiceNumber === invoiceNumber);
    if (!targetInvoice) {
      console.error('[Delete] Invoice not found:', invoiceNumber);
      return;
    }

    if (confirm(`Delete "${targetInvoice.clientName}" (${invoiceNumber})? It will be moved to Deleted tab.`)) {
      // Soft delete: mark as deleted instead of removing
      const updated = savedInvoices.map(inv =>
        inv.invoiceNumber === invoiceNumber ? { ...inv, deletedAt: new Date().toISOString(), status: 'cancelled' as const } : inv
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSavedInvoices(updated);

      // Sync deletion to Google Sheets
      const deletedInvoice = updated.find(inv => inv.invoiceNumber === invoiceNumber);
      if (deletedInvoice && isGoogleSyncEnabled()) {
        setSyncStatus('syncing');
        saveInvoiceToGoogle(deletedInvoice as GoogleStoredInvoice)
          .then((result) => {
            if (result.success) {
              setSyncStatus('synced');
              setLastSyncTime(new Date());
            } else {
              setSyncStatus('error');
            }
          })
          .catch(() => setSyncStatus('error'));
      }
    }
  };

  // Restore a soft-deleted invoice - uses invoiceNumber as unique identifier
  const restoreInvoice = (invoiceNumber: string) => {
    const updated = savedInvoices.map(inv =>
      inv.invoiceNumber === invoiceNumber ? { ...inv, deletedAt: undefined, status: 'draft' as const } : inv
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSavedInvoices(updated);

    // Sync restoration to Google Sheets
    const restoredInvoice = updated.find(inv => inv.invoiceNumber === invoiceNumber);
    if (restoredInvoice && isGoogleSyncEnabled()) {
      setSyncStatus('syncing');
      saveInvoiceToGoogle(restoredInvoice as GoogleStoredInvoice)
        .then((result) => {
          if (result.success) {
            setSyncStatus('synced');
            setLastSyncTime(new Date());
          } else {
            setSyncStatus('error');
          }
        })
        .catch(() => setSyncStatus('error'));
    }
  };

  // Permanently delete an invoice - uses invoiceNumber as unique identifier
  const permanentlyDeleteInvoice = (invoiceNumber: string) => {
    const targetInvoice = savedInvoices.find(inv => inv.invoiceNumber === invoiceNumber);
    if (!targetInvoice) return;

    if (confirm(`Permanently delete "${targetInvoice.clientName}" (${invoiceNumber})? This cannot be undone.`)) {
      const updated = savedInvoices.filter(inv => inv.invoiceNumber !== invoiceNumber);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSavedInvoices(updated);
      // Note: This doesn't delete from Google Sheets - manual cleanup needed
    }
  };

  // Update invoice status - uses invoiceNumber as unique identifier (not id)
  const updateInvoiceStatusLocal = (invoiceNumber: string, status: StoredInvoice['status']) => {
    // Find the invoice first to log what we're updating
    const targetInvoice = savedInvoices.find(inv => inv.invoiceNumber === invoiceNumber);
    if (!targetInvoice) {
      console.error('[Status Update] Invoice not found:', invoiceNumber);
      alert('Error: Invoice not found');
      return;
    }

    console.log('[Status Update] Updating:', {
      invoiceNumber,
      clientName: targetInvoice.clientName,
      from: targetInvoice.status,
      to: status,
    });

    const updated = savedInvoices.map(inv =>
      inv.invoiceNumber === invoiceNumber ? { ...inv, status } : inv
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSavedInvoices(updated);

    // Sync status to Google
    if (isGoogleSyncEnabled()) {
      setSyncStatus('syncing');
      saveInvoiceToGoogle({ ...targetInvoice, status } as GoogleStoredInvoice)
        .then((result) => {
          if (result.success) {
            setSyncStatus('synced');
            setLastSyncTime(new Date());
          } else {
            setSyncStatus('error');
          }
        })
        .catch(() => setSyncStatus('error'));
    }
  };

  // Package presets (from cloud config, falls back to site.config.ts)
  const packagePresets = cloudPackages.map(pkg => ({
    name: pkg.name,
    price: pkg.price,
    details: pkg.description,
    setDeposit: true,
  }));

  // Add-on presets (from cloud config, falls back to site.config.ts)
  const addOnPresets = cloudAddons.map(addon => ({
    name: addon.name,
    price: addon.price,
    details: addon.description,
  }));

  // Transport presets (from config)
  const transportPresets = siteConfig.transport.zones.map(zone => ({
    name: `Transport (${zone.name})`,
    price: zone.price,
    details: zone.description,
  }));

  // Apply main package (replaces items)
  const applyPackage = (preset: typeof packagePresets[0]) => {
    setItems([
      {
        id: '1',
        description: preset.name,
        details: preset.details,
        quantity: 1,
        rate: preset.price,
      },
    ]);
    if (preset.setDeposit) {
      setDepositPaid(Math.round(preset.price * (siteConfig.terms.depositPercent / 100)));
    }
  };

  // Add add-on (adds to existing items)
  const addAddOn = (preset: typeof addOnPresets[0]) => {
    addItem({
      description: preset.name,
      details: preset.details,
      rate: preset.price,
    });
  };

  // Sync all data to Google
  const [isSyncing, setIsSyncing] = useState(false);
  const [showWhatsAppMenu, setShowWhatsAppMenu] = useState(false);
  const [historyWhatsAppMenu, setHistoryWhatsAppMenu] = useState<string | null>(null); // Track which invoice's WhatsApp menu is open

  const handleSyncToGoogle = async () => {
    if (!isGoogleSyncEnabled()) {
      alert('Google sync is not configured. Set NEXT_PUBLIC_GOOGLE_SCRIPT_URL in your environment.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('syncing');
    try {
      console.log('[Invoice] Starting sync of', savedInvoices.length, 'invoices');
      const result = await syncAllInvoices(savedInvoices as GoogleStoredInvoice[]);
      console.log('[Invoice] Sync result:', result);

      if (result.success) {
        setSyncStatus('synced');
        setLastSyncTime(new Date());
        alert(`Successfully synced ${savedInvoices.length} items to Google Sheets!`);
      } else {
        setSyncStatus('error');
        alert('Sync error: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      setSyncStatus('error');
      console.error('[Invoice] Sync exception:', error);
      alert('Sync failed: ' + String(error));
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual refresh from cloud
  const handleRefreshFromCloud = async () => {
    if (!isGoogleSyncEnabled()) {
      alert('Google sync is not configured.');
      return;
    }

    setSyncStatus('syncing');
    try {
      const result = await fetchInvoicesFromCloud();
      if (result.success) {
        const cloudInvoices = result.invoices as StoredInvoice[];
        setSavedInvoices(cloudInvoices);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudInvoices));
        setSyncStatus('synced');
        setLastSyncTime(new Date());
        alert(`Loaded ${cloudInvoices.length} invoices from cloud!`);
      } else {
        setSyncStatus('error');
        alert('Failed to fetch from cloud: ' + result.error);
      }
    } catch (error) {
      setSyncStatus('error');
      console.error('Refresh failed:', error);
      alert('Failed to refresh from cloud.');
    }
  };

  // Create calendar event for current invoice
  const handleCreateCalendarEvent = async () => {
    if (!isGoogleSyncEnabled()) {
      alert('Google sync is not configured.');
      return;
    }

    if (!eventDate || !clientName) {
      alert('Please fill in event date and client name first.');
      return;
    }

    try {
      await createCalendarEvent({
        clientName,
        clientPhone,
        clientEmail,
        eventType,
        eventDate,
        eventTime: `${eventTimeHour}:${eventTimeMinute} ${eventTimePeriod}`,
        venue: eventVenue,
        packageName: items[0]?.description || '',
        total: totalAfterDiscount,
        depositPaid,
        invoiceNumber,
        notes: '',
      });
      alert('Calendar event created with reminders!');
      setCalendarCreated(true);
    } catch (error) {
      alert('Failed to create calendar event.');
      console.error(error);
    }
  };

  // Handle marking deposit as received
  const handleMarkDepositReceived = async () => {
    // Priority: depositPaid > depositRequested > calculated percentage
    const deposit = depositPaid > 0
      ? depositPaid
      : depositRequested > 0
        ? depositRequested
        : Math.round(totalAfterDiscount * (siteConfig.terms.depositPercent / 100));

    if (confirm(`Mark deposit of RM ${deposit} as received?\n\nThis will:\n• Set payment status to "Deposit Received"\n• Auto-create calendar event (if not already created)\n• Convert quotation to invoice (if applicable)`)) {
      // Set deposit amount if not already set
      if (depositPaid === 0) {
        setDepositPaid(deposit);
      }

      // Update payment status
      setPaymentStatus('deposit');
      setDepositReceivedDate(new Date().toISOString().split('T')[0]);

      // Update status to deposit_received
      setCurrentStatus('deposit_received');

      // If this is a quotation, convert to invoice
      if (documentType === 'quotation') {
        await convertToInvoice();
      }

      // Auto-create calendar event if not already created
      if (!calendarCreated && eventDate && clientName && isGoogleSyncEnabled()) {
        try {
          const result = await createCalendarEvent({
            clientName,
            clientPhone,
            clientEmail,
            eventType,
            eventDate,
            eventTime: `${eventTimeHour}:${eventTimeMinute} ${eventTimePeriod}`,
            venue: eventVenue,
            packageName: items[0]?.description || '',
            total: totalAfterDiscount,
            depositPaid: deposit,
            invoiceNumber,
            notes: '',
          });
          if (result.success) {
            setCalendarCreated(true);
            setCalendarEventId(result.eventId);
          }
        } catch (error) {
          console.error('Failed to create calendar event:', error);
        }
      }

      // Auto-save
      saveInvoice('deposit_received');
    }
  };

  // Handle marking balance as paid
  const handleMarkBalancePaid = () => {
    if (confirm(`Mark balance of RM ${balanceDue} as paid?\n\nThis will:\n• Set payment status to "Full"\n• Mark as "Fully Paid"`)) {
      setPaymentStatus('full');
      setBalanceReceivedDate(new Date().toISOString().split('T')[0]);
      setCurrentStatus('balance_paid');

      // Auto-save
      saveInvoice('balance_paid');
    }
  };

  // Handle marking event as completed
  const handleMarkCompleted = () => {
    if (confirm('Mark event as completed?\n\nThis confirms the performance has been done.')) {
      setEventCompletedDate(new Date().toISOString().split('T')[0]);
      setCurrentStatus('completed');

      // Auto-save
      saveInvoice('completed');
    }
  };

  // Handle marking as sent (quotation or invoice)
  const handleMarkSent = () => {
    const newStatus = documentType === 'quotation' ? 'quotation_sent' : 'invoice_sent';
    if (newStatus === 'invoice_sent') {
      setInvoiceSentDate(new Date().toISOString().split('T')[0]);
    }
    setCurrentStatus(newStatus);
    saveInvoice(newStatus);
  };

  // Send WhatsApp message with template
  const handleSendWhatsApp = (templateId: MessageTemplateId) => {
    if (!clientPhone) {
      alert('Please enter client phone number first.');
      return;
    }

    let message = '';
    const deposit = Math.round(totalAfterDiscount * (siteConfig.terms.depositPercent / 100));
    const eventTimeStr = `${eventTimeHour}:${eventTimeMinute} ${eventTimePeriod}`;

    switch (templateId) {
      case 'quotation':
        message = generateQuotationMessage({
          clientName: clientName || 'Client',
          eventDate: eventDate || 'TBC',
          eventTime: eventTimeStr,
          venue: eventVenue || 'TBC',
          packageName: items[0]?.description || 'Performance Package',
          total: totalAfterDiscount,
          deposit,
          invoiceNumber,
        });
        break;
      case 'confirmation':
        message = generateConfirmationMessage({
          clientName: clientName || 'Client',
          eventDate: eventDate || 'TBC',
          eventTime: eventTimeStr,
          venue: eventVenue || 'TBC',
          depositAmount: depositPaid,
          balanceAmount: balanceDue,
        });
        break;
      case 'balance':
        message = generateBalanceReminderMessage({
          clientName: clientName || 'Client',
          eventDate: eventDate || 'TBC',
          eventTime: eventTimeStr,
          venue: eventVenue || 'TBC',
          balanceAmount: balanceDue,
          dueDate: formattedBalanceDueDate,
        });
        break;
      case 'songs':
        message = generateSongConfirmationMessage({
          clientName: clientName || 'Client',
          eventDate: eventDate || 'TBC',
          currentSongs: items.map(item => item.description).filter(Boolean),
        });
        break;
      case 'thankyou':
        message = generateThankYouMessage({
          clientName: clientName || 'Client',
          eventType: eventType || 'event',
          eventDate: eventDate || 'your special day',
        });
        break;
    }

    openWhatsAppWithMessage(clientPhone, message);
    setShowWhatsAppMenu(false);
  };

  // Loading state - prevents flash
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-amber-400 text-lg">Loading...</div>
      </div>
    );
  }

  // Password protection screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Invoice Generator</h1>
            <p className="text-slate-500 mt-2">Enter password to access</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-amber-500 focus:outline-none pr-12"
                autoFocus
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
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
            >
              Access Invoice Generator
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-amber-600 hover:text-amber-700 text-sm">
              ← Back to Website
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-slate-900 text-white py-3 px-4 sm:py-4 sm:px-6 print-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Top row - Back & Title */}
          <div className="flex items-center justify-between mb-3 sm:mb-0">
            <div className="flex items-center gap-2 sm:gap-4">
              <h1 className="text-base sm:text-xl font-semibold">
                {documentType === 'quotation' ? 'Quotation' : 'Invoice'}
              </h1>
              {/* Navigation Links */}
              <nav className="hidden sm:flex items-center gap-1 ml-2 border-l border-slate-700 pl-3">
                <Link
                  href="/"
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                >
                  <Home className="w-3 h-3" />
                  Site
                </Link>
                <Link
                  href="/admin"
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  Admin
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                >
                  <LayoutDashboard className="w-3 h-3" />
                  Dashboard
                </Link>
              </nav>
            </div>
            {/* Desktop buttons - Simplified with auto-sync */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={startNew}
                className="flex items-center gap-2 bg-slate-700 text-white px-3 py-2 rounded-lg font-medium hover:bg-slate-600 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-2 bg-slate-700 text-white px-3 py-2 rounded-lg font-medium hover:bg-slate-600 transition-colors text-sm"
              >
                <History className="w-4 h-4" />
                History ({activeInvoices.length})
              </button>
              {GOOGLE_SHEET_URL && (
                <a
                  href={GOOGLE_SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-slate-700 text-white px-3 py-2 rounded-lg font-medium hover:bg-slate-600 transition-colors text-sm"
                  title="View inquiries & invoices in Google Sheets"
                >
                  <ExternalLink className="w-4 h-4" />
                  Sheets
                </a>
              )}
              {eventDate && clientName && isGoogleSyncEnabled() && (
                <button
                  onClick={handleCreateCalendarEvent}
                  className="flex items-center gap-2 bg-slate-700 text-white px-3 py-2 rounded-lg font-medium hover:bg-slate-600 transition-colors text-sm"
                  title="Create calendar event with reminders"
                >
                  <Calendar className="w-4 h-4" />
                  Calendar
                </button>
              )}
              {clientPhone && (
                <div className="relative">
                  <button
                    onClick={() => setShowWhatsAppMenu(!showWhatsAppMenu)}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-green-500 transition-colors text-sm"
                    title="Send WhatsApp message"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </button>
                  {showWhatsAppMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50">
                      {messageTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleSendWhatsApp(template.id)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="font-medium text-slate-800">{template.name}</div>
                          <div className="text-xs text-slate-500">{template.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Save button with smart save + sync indicator */}
              <button
                onClick={() => {
                  saveInvoice(currentStatus || 'draft');
                }}
                disabled={syncStatus === 'syncing' || (!hasUnsavedChanges && !justSaved && lastSavedState !== '')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  justSaved
                    ? 'bg-emerald-600 text-white'
                    : syncStatus === 'error'
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : hasUnsavedChanges
                        ? 'bg-amber-500 text-white hover:bg-amber-400'
                        : lastSavedState === ''
                          ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                          : 'bg-slate-400 text-white cursor-not-allowed'
                }`}
                title={
                  justSaved ? 'Saved!' :
                  hasUnsavedChanges ? 'Unsaved changes - click to save' :
                  syncStatus === 'synced' ? 'All changes saved' :
                  syncStatus === 'syncing' ? 'Saving...' :
                  syncStatus === 'error' ? 'Error - click to retry' :
                  'No changes to save'
                }
              >
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : justSaved ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {justSaved ? 'Saved!' : hasUnsavedChanges ? 'Save*' : 'Save'}
                {/* Sync status dot */}
                {isGoogleSyncEnabled() && !justSaved && (
                  <span className={`w-2 h-2 rounded-full ml-1 ${
                    syncStatus === 'synced' ? 'bg-green-300' :
                    syncStatus === 'syncing' ? 'bg-yellow-300 animate-pulse' :
                    syncStatus === 'error' ? 'bg-red-300' :
                    'bg-slate-300'
                  }`} />
                )}
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-amber-500 text-slate-900 px-3 py-2 rounded-lg font-medium hover:bg-amber-400 transition-colors text-sm"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              {/* Contextual workflow buttons */}
              {/* Mark as Sent (for drafts) */}
              {(currentStatus === 'quotation_draft' || currentStatus === 'draft') && items.length > 0 && (
                <button
                  onClick={handleMarkSent}
                  className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-400 transition-colors text-sm"
                  title="Mark quotation as sent to client"
                >
                  <Send className="w-4 h-4" />
                  Mark Sent
                </button>
              )}
              {/* Deposit Received button (for quotations that are sent or invoices without deposit) */}
              {(isSentStatus(currentStatus) || (documentType === 'invoice' && paymentStatus === 'none')) && items.length > 0 && (
                <button
                  onClick={handleMarkDepositReceived}
                  className="flex items-center gap-2 bg-teal-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-teal-400 transition-colors text-sm"
                  title="Mark deposit as received - converts to invoice and creates calendar"
                >
                  <DollarSign className="w-4 h-4" />
                  Deposit Received
                </button>
              )}
              {/* Balance Paid button (for invoices with deposit but not fully paid) */}
              {paymentStatus === 'deposit' && balanceDue > 0 && (
                <button
                  onClick={handleMarkBalancePaid}
                  className="flex items-center gap-2 bg-emerald-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-emerald-400 transition-colors text-sm"
                  title="Mark balance as fully paid"
                >
                  <CheckCircle className="w-4 h-4" />
                  Balance Paid
                </button>
              )}
              {/* Mark Completed (for paid events) */}
              {isFullyPaidStatus(currentStatus) && !eventCompletedDate && (
                <button
                  onClick={handleMarkCompleted}
                  className="flex items-center gap-2 bg-purple-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-purple-400 transition-colors text-sm"
                  title="Mark event as completed"
                >
                  <CheckCircle className="w-4 h-4" />
                  Completed
                </button>
              )}
              {/* Convert to Invoice (legacy button - now deposit triggers conversion) */}
              {documentType === 'quotation' && items.length > 0 && !isSentStatus(currentStatus) && currentStatus !== 'quotation_draft' && (
                <button
                  onClick={convertToInvoice}
                  className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-400 transition-colors text-sm"
                >
                  <FileText className="w-4 h-4" />
                  Convert
                </button>
              )}
              {/* Receipt button */}
              {depositPaid > 0 && (
                <button
                  onClick={handlePrintReceipt}
                  className="flex items-center gap-2 bg-slate-700 text-white px-3 py-2 rounded-lg font-medium hover:bg-slate-600 transition-colors text-sm"
                  title="Print payment receipt"
                >
                  <Receipt className="w-4 h-4" />
                  Receipt
                </button>
              )}
            </div>
          </div>
          {/* Mobile buttons - two rows for better touch targets */}
          <div className="flex md:hidden flex-col gap-2">
            {/* Row 1: Main actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startNew}
                className="flex items-center gap-1 bg-slate-700 text-white px-3 py-2 rounded-lg font-medium text-xs"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1 bg-slate-700 text-white px-3 py-2 rounded-lg font-medium text-xs"
              >
                <History className="w-4 h-4" />
                {activeInvoices.length}
              </button>
              <button
                type="button"
                onClick={() => saveInvoice(currentStatus || 'draft')}
                disabled={syncStatus === 'syncing' || (!hasUnsavedChanges && !justSaved && lastSavedState !== '')}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
                  justSaved
                    ? 'bg-emerald-600 text-white'
                    : syncStatus === 'error'
                      ? 'bg-red-500 text-white'
                      : hasUnsavedChanges
                        ? 'bg-amber-500 text-white'
                        : lastSavedState === ''
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-400 text-white cursor-not-allowed'
                }`}
              >
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : justSaved ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {justSaved ? 'Saved!' : hasUnsavedChanges ? 'Save*' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1 bg-amber-500 text-slate-900 px-3 py-2 rounded-lg font-medium text-xs"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPDF()}
                className="flex items-center gap-1 bg-blue-500 text-white px-3 py-2 rounded-lg font-medium text-xs"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            </div>
            {/* Row 2: WhatsApp & Convert (only show if relevant) */}
            {(clientPhone || (documentType === 'quotation' && items.length > 0)) && (
              <div className="flex items-center gap-2">
                {clientPhone && (
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppMenu(!showWhatsAppMenu)}
                    className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-lg font-medium text-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </button>
                )}
                {documentType === 'quotation' && items.length > 0 && (
                  <button
                    type="button"
                    onClick={convertToInvoice}
                    className="flex items-center gap-1 bg-blue-500 text-white px-3 py-2 rounded-lg font-medium text-xs"
                  >
                    <FileText className="w-4 h-4" />
                    Convert to Invoice
                  </button>
                )}
              </div>
            )}
          </div>
          {/* WhatsApp menu modal */}
          {showWhatsAppMenu && (
            <div className="md:hidden fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowWhatsAppMenu(false)}>
              <div
                className="w-full bg-white rounded-t-2xl p-4 pb-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
                <h3 className="font-semibold text-slate-800 mb-3">Send WhatsApp Message</h3>
                <div className="space-y-2">
                  {messageTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleSendWhatsApp(template.id)}
                      className="w-full text-left p-3 bg-slate-50 rounded-lg active:bg-slate-100"
                    >
                      <div className="font-medium text-slate-800">{template.name}</div>
                      <div className="text-xs text-slate-500">{template.description}</div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowWhatsAppMenu(false)}
                  className="w-full mt-4 p-3 bg-slate-200 rounded-lg font-medium text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filename Preview */}
      <div className="bg-slate-800 text-slate-400 py-1 px-4 text-xs text-center print-hidden">
        📄 PDF filename: <span className="text-amber-400 font-mono">{generateFilename()}.pdf</span>
      </div>

      <div className="max-w-7xl mx-auto py-4 sm:py-8 px-4 sm:px-6 print:p-0 print:max-w-none">
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 print:block">
          {/* Form Panel - On mobile, show after preview */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6 print-hidden order-2 lg:order-1">
            {/* Main Packages */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 sm:mb-4 text-sm sm:text-base">📦 Main Package</h3>
              <div className="grid grid-cols-2 gap-2">
                {packagePresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyPackage(preset)}
                    className="text-left p-3 border rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-colors"
                  >
                    <div className="font-medium text-sm text-slate-800">{preset.name}</div>
                    <div className="text-amber-600 font-semibold">RM {preset.price}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Add-ons */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 sm:mb-4 text-sm sm:text-base">➕ Add-Ons</h3>
              <div className="grid grid-cols-2 gap-2">
                {addOnPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => addAddOn(preset)}
                    className="text-left p-2 border border-dashed rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-colors"
                  >
                    <div className="font-medium text-xs text-slate-800">{preset.name}</div>
                    <div className="text-amber-600 text-sm font-semibold">+RM {preset.price}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => addItem()}
                className="mt-3 w-full flex items-center justify-center gap-2 text-amber-600 hover:text-amber-700 py-2 border border-amber-300 rounded-lg hover:bg-amber-50"
              >
                <Plus className="w-4 h-4" />
                Add Custom Item
              </button>
            </div>

            {/* Transport & Tolls */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 sm:mb-4 text-sm sm:text-base">🚗 Transport & Tolls</h3>
              <p className="text-xs text-slate-500 mb-3">Venues outside Cyberjaya</p>
              <div className="space-y-2">
                {transportPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => addAddOn(preset)}
                    className="w-full text-left p-2 border border-dashed rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-colors flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-xs text-slate-800">{preset.name}</div>
                      <div className="text-xs text-slate-500">{preset.details}</div>
                    </div>
                    <div className="text-amber-600 text-sm font-semibold">
                      {preset.price > 0 ? `+RM ${preset.price}` : 'Custom'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Document Type */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 sm:mb-4 text-sm sm:text-base">📄 Document Type</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => updateDocumentNumber('quotation')}
                  className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                    documentType === 'quotation'
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Quotation
                </button>
                <button
                  onClick={() => updateDocumentNumber('invoice')}
                  className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                    documentType === 'invoice'
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Invoice
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                {documentType === 'quotation'
                  ? '📋 Quotation: Send before booking to show estimated price'
                  : '🧾 Invoice: Send after client confirms to request deposit'}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    {documentType === 'quotation' ? 'Quotation' : 'Invoice'} Number
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Client Details */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 sm:mb-4 text-sm sm:text-base">👤 Client Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Client Name *</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ahmad & Siti"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+60 12-345 6789"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@email.com"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Address (optional)</label>
                  <textarea
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="Client address..."
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Lead Source</label>
                  <select
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value as typeof leadSource)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="">-- Select Source --</option>
                    <option value="Web">Web</option>
                    <option value="Instagram">Instagram</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Referral">Referral</option>
                    <option value="Collaboration">Collaboration</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {leadSource === 'Collaboration' && (
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Collaboration Partner</label>
                    <input
                      type="text"
                      value={collaborationPartner}
                      onChange={(e) => setCollaborationPartner(e.target.value)}
                      placeholder="e.g., Baskara, Primadona, Skyeglass"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      list="collaboration-partners"
                    />
                    <datalist id="collaboration-partners">
                      <option value="Baskara" />
                      <option value="Primadona" />
                      <option value="Skyeglass" />
                    </datalist>
                  </div>
                )}
                {leadSource === 'Referral' && (
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Referred by</label>
                    <input
                      type="text"
                      value={collaborationPartner}
                      onChange={(e) => setCollaborationPartner(e.target.value)}
                      placeholder="Who referred this client?"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                )}
                {leadSource === 'Other' && (
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Specify Source</label>
                    <input
                      type="text"
                      value={collaborationPartner}
                      onChange={(e) => setCollaborationPartner(e.target.value)}
                      placeholder="Where did this lead come from?"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Event Details */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 sm:mb-4 text-sm sm:text-base">📅 Event Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Event Type</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option>Wedding Reception</option>
                    <option>Wedding Solemnization</option>
                    <option>Corporate Event</option>
                    <option>Private Party</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Event Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Event Time</label>
                  <div className="flex gap-2">
                    <select
                      value={eventTimeHour}
                      onChange={(e) => setEventTimeHour(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                    >
                      {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      value={eventTimeMinute}
                      onChange={(e) => setEventTimeMinute(e.target.value)}
                      className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                    >
                      {['00', '15', '30', '45'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={eventTimePeriod}
                      onChange={(e) => setEventTimePeriod(e.target.value)}
                      className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                    >
                      <option>AM</option>
                      <option>PM</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Venue</label>
                  <input
                    type="text"
                    value={eventVenue}
                    onChange={(e) => setEventVenue(e.target.value)}
                    placeholder="Venue name & location"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 sm:mb-4 text-sm sm:text-base">💰 Payment & Discount</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Discount / Promo</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      placeholder="0"
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as 'amount' | 'percent')}
                      className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="amount">RM</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                </div>
                {/* Deposit Requested - for Quotations */}
                {documentType === 'quotation' && (
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Deposit Required (RM)</label>
                    <input
                      type="number"
                      value={depositRequested || ''}
                      onChange={(e) => setDepositRequested(Number(e.target.value))}
                      placeholder={(totalAfterDiscount * (siteConfig.terms.depositPercent / 100)).toFixed(0)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Default {siteConfig.terms.depositPercent}% = RM {(totalAfterDiscount * (siteConfig.terms.depositPercent / 100)).toFixed(2)}
                    </p>
                  </div>
                )}
                {/* Deposit Paid - for Invoices */}
                {documentType === 'invoice' && (
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Deposit Received (RM)</label>
                    <input
                      type="number"
                      value={depositPaid}
                      onChange={(e) => setDepositPaid(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">{siteConfig.terms.depositPercent}% of total = RM {(totalAfterDiscount * (siteConfig.terms.depositPercent / 100)).toFixed(2)}</p>
                  </div>
                )}

                {/* Payment Status Indicator */}
                <div className="pt-2 border-t mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Payment Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      paymentStatus === 'full' ? 'bg-emerald-100 text-emerald-700' :
                      paymentStatus === 'deposit' ? 'bg-teal-100 text-teal-700' :
                      paymentStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {paymentStatus === 'full' ? '✓ Fully Paid' :
                       paymentStatus === 'deposit' ? '◐ Deposit Received' :
                       paymentStatus === 'partial' ? '◔ Partial Payment' :
                       '○ No Payment'}
                    </span>
                  </div>
                  {depositReceivedDate && (
                    <p className="text-xs text-teal-600 mt-1">Deposit received: {depositReceivedDate}</p>
                  )}
                  {balanceReceivedDate && (
                    <p className="text-xs text-emerald-600 mt-1">Balance paid: {balanceReceivedDate}</p>
                  )}
                  {calendarCreated && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Calendar event created
                    </p>
                  )}
                  {eventCompletedDate && (
                    <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Event completed: {eventCompletedDate}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Preview */}
          <div id="invoice-preview" className="lg:col-span-2 order-1 lg:order-2">
            <div
              className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-10 print:shadow-none print:rounded-none print:p-8"
              style={{ fontFamily: 'Segoe UI, system-ui, sans-serif' }}
            >
              {/* Header */}
              <div className="print-section flex flex-col sm:flex-row sm:justify-between sm:items-start border-b-4 border-amber-500 pb-4 sm:pb-6 mb-4 sm:mb-8 gap-4">
                <div className="text-center sm:text-left">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1">🎷 {siteConfig.business.name}</h1>
                  <p className="text-slate-500 text-sm">{siteConfig.business.tagline}</p>
                  {siteConfig.business.ssm && <p className="text-slate-400 text-xs mt-1">SSM: {siteConfig.business.ssm}</p>}
                </div>
                <div className="text-center sm:text-right">
                  <h2 className="text-3xl sm:text-4xl font-bold text-amber-500 mb-2">
                    {documentType === 'quotation' ? 'QUOTATION' : 'INVOICE'}
                  </h2>
                  <p className="text-slate-600 text-sm sm:text-base"><strong>No:</strong> {invoiceNumber}</p>
                  {linkedQuotationNumber && documentType === 'invoice' && (
                    <p className="text-slate-500 text-xs"><strong>Ref:</strong> {linkedQuotationNumber}</p>
                  )}
                  <p className="text-slate-600 text-sm sm:text-base"><strong>Date:</strong> {new Date(invoiceDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  {documentType === 'quotation' && (
                    <p className="text-xs text-amber-600 mt-2">Valid for 7 days</p>
                  )}
                </div>
              </div>

              {/* Client & Event Info */}
              <div className="print-section grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-4 sm:mb-8">
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-amber-600 font-semibold mb-2">Bill To</h3>
                  <p className="text-slate-800 font-semibold">{clientName || '[Client Name]'}</p>
                  {clientAddress && <p className="text-slate-600 text-sm whitespace-pre-line">{clientAddress}</p>}
                  {clientPhone && <p className="text-slate-600 text-sm">Phone: {clientPhone}</p>}
                  {clientEmail && <p className="text-slate-600 text-sm">Email: {clientEmail}</p>}
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-amber-600 font-semibold mb-2">Event Details</h3>
                  <p className="text-slate-600 text-sm"><strong>Event:</strong> {eventType}</p>
                  <p className="text-slate-600 text-sm"><strong>Date:</strong> {eventDate ? new Date(eventDate).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '[Event Date]'}</p>
                  <p className="text-slate-600 text-sm"><strong>Time:</strong> {formattedTime}</p>
                  <p className="text-slate-600 text-sm"><strong>Venue:</strong> {eventVenue || '[Venue]'}</p>
                </div>
              </div>

              {/* Items Table */}
              {items.length > 0 ? (
                <table className="w-full mb-6">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="text-left py-2 px-3 text-xs uppercase tracking-wider" style={{ width: '55%' }}>Description</th>
                      <th className="text-center py-2 px-2 text-xs uppercase tracking-wider" style={{ width: '10%' }}>Qty</th>
                      <th className="text-right py-2 px-2 text-xs uppercase tracking-wider" style={{ width: '15%' }}>Rate</th>
                      <th className="text-right py-2 px-3 text-xs uppercase tracking-wider" style={{ width: '20%' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-200">
                        <td className="py-4 px-3 align-middle">
                          <div className="print:hidden flex items-start gap-2">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                placeholder="Service description"
                                className="w-full font-medium text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-amber-500 focus:outline-none text-sm"
                              />
                              <input
                                type="text"
                                value={item.details}
                                onChange={(e) => updateItem(item.id, 'details', e.target.value)}
                                placeholder="Additional details"
                                className="w-full text-xs text-slate-500 border-b border-transparent hover:border-slate-300 focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="hidden print:block">
                            <div className="font-medium text-slate-800 text-sm">{item.description}</div>
                            {item.details && <div className="text-xs text-slate-500 mt-0.5">{item.details}</div>}
                          </div>
                        </td>
                        <td className="py-4 px-2 text-center align-middle" style={{ width: '10%' }}>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                            className="w-10 text-center border rounded px-1 py-1 print:hidden text-sm"
                          />
                          <span className="hidden print:inline text-sm">{item.quantity}</span>
                        </td>
                        <td className="py-4 px-2 text-right align-middle" style={{ width: '15%' }}>
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(item.id, 'rate', Number(e.target.value))}
                            className="w-16 text-right border rounded px-1 py-1 print:hidden text-sm"
                          />
                          <span className="hidden print:inline text-sm">RM {item.rate.toFixed(2)}</span>
                        </td>
                        <td className="py-4 px-3 text-right font-medium align-middle" style={{ width: '20%' }}>
                          <span className="text-sm">RM {(item.quantity * item.rate).toFixed(2)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-lg mb-6">
                  Select a package or add items from the left panel
                </div>
              )}

              {/* Totals - Compact */}
              <div className="print-section flex justify-end mb-3 sm:mb-6">
                <div className="w-full sm:w-64">
                  <div className="flex justify-between py-1.5 border-b border-slate-200 text-sm">
                    <span className="text-slate-600">Subtotal</span>
                    <span>RM {subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-200 text-green-600 text-sm">
                      <span>Discount</span>
                      <span>-RM {discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-200 text-sm">
                      <span className="text-slate-600">Total</span>
                      <span>RM {totalAfterDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {documentType === 'invoice' && (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-200 text-sm">
                        <span className="text-slate-600">Deposit Paid</span>
                        <span>-RM {depositPaid.toFixed(2)}</span>
                      </div>
                      {currentStatus === 'paid' ? (
                        <div className="flex justify-between py-2 border-b-2 border-emerald-500 font-semibold text-emerald-600">
                          <span>Balance Due</span>
                          <span>RM 0.00 PAID</span>
                        </div>
                      ) : (
                        <div className="flex justify-between py-2 border-b-2 border-amber-500 font-semibold">
                          <span>Balance Due</span>
                          <span className={balanceDue < 0 ? 'text-green-600' : ''}>
                            RM {balanceDue.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {documentType === 'quotation' && (
                    <>
                      <div className="flex justify-between py-2 border-b-2 border-amber-500 font-semibold">
                        <span>Total Estimated</span>
                        <span>RM {totalAfterDiscount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-xs text-slate-500">
                        <span>Deposit Required {!depositRequested && `(${siteConfig.terms.depositPercent}%)`}</span>
                        <span>RM {(depositRequested > 0 ? depositRequested : (totalAfterDiscount * (siteConfig.terms.depositPercent / 100))).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Info - Compact for PDF */}
              <div className="print-keep-together">
                <div className="bg-slate-50 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 border border-slate-200 print:bg-gray-50 print:border-gray-300">
                  <h3 className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold mb-1.5">Payment Details</h3>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <p><strong>Bank:</strong> {siteConfig.banking.bank}</p>
                    <p><strong>Account Name:</strong> {siteConfig.banking.accountName}</p>
                    <p><strong>Account No:</strong> {siteConfig.banking.accountNumber}</p>
                    <p><strong>Reference:</strong> {extractDateOnly(eventDate).replace(/-/g, '') || 'BOOKING'}-{(clientName || 'CLIENT').split(' ').filter(n => /^[a-zA-Z]/.test(n)).map(n => n[0]).join('').toUpperCase().substring(0, 3)}</p>
                  </div>
                </div>

                {/* Terms - Two Column Layout */}
                <div className="text-[10px] text-slate-500 mb-2">
                  <h4 className="font-semibold text-slate-700 mb-1.5 text-[11px]">Terms & Conditions</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {documentType === 'quotation' ? (
                      <>
                        <p>• Valid for {siteConfig.terms.quotationValidDays} days from date above</p>
                        <p>• Balance due by <strong className="text-amber-600">{formattedBalanceDueDate}</strong></p>
                        <p>• Payment: {siteConfig.terms.paymentMethods}</p>
                        <p>• {siteConfig.terms.latePaymentPolicy}</p>
                        <p>• {siteConfig.terms.depositPercent}% deposit to confirm booking</p>
                        <p>• Transport charges outside {siteConfig.transport.baseLocation}</p>
                      </>
                    ) : (
                      <>
                        <p>• Payment: {siteConfig.terms.paymentMethods}</p>
                        <p>• Balance due by <strong className="text-amber-600">{formattedBalanceDueDate}</strong></p>
                        <p>• {siteConfig.terms.depositPercent}% deposit to confirm</p>
                        <p>• {siteConfig.terms.latePaymentPolicy}</p>
                        <p>• Cancellation: {siteConfig.terms.cancellationPolicy}</p>
                        <p>• Rescheduling: {siteConfig.terms.reschedulingPolicy}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer - with breathing room */}
              <div className="print-section text-center text-[10px] text-slate-500 pt-4 mt-4 border-t border-slate-200">
                <p className="font-semibold text-slate-700 text-[11px]">{siteConfig.business.name}</p>
                <p>{getPhoneDisplay()} | {siteConfig.contact.email}{siteConfig.social.instagram ? ` | @${siteConfig.social.instagram}` : ''}</p>
                <p className="mt-0.5 text-amber-600">Thank you for your business!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal (for printing) */}
      {showReceipt && (
        <div id="receipt-preview" className="fixed inset-0 bg-white z-50 p-8 print:p-0">
          <div className="max-w-md mx-auto bg-white" style={{ fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
            {/* Receipt Header */}
            <div className="text-center border-b-4 border-emerald-500 pb-4 mb-6">
              <h1 className="text-2xl font-bold text-slate-800 mb-1">🎷 {siteConfig.business.name}</h1>
              <p className="text-slate-500 text-sm">{siteConfig.business.tagline}</p>
              {siteConfig.business.ssm && <p className="text-slate-400 text-xs mt-1">SSM: {siteConfig.business.ssm}</p>}
            </div>

            {/* Receipt Title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full">
                <CheckCircle className="w-5 h-5" />
                <span className="font-bold text-lg">PAYMENT RECEIPT</span>
              </div>
              <p className="text-slate-500 text-sm mt-2">Receipt #{invoiceNumber.replace('INV', 'RCP').replace('QUO', 'RCP')}</p>
              <p className="text-slate-400 text-xs">Date: {new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            {/* Client Info */}
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-slate-700 mb-2">Received From:</h3>
              <p className="font-medium text-slate-800">{clientName || 'Client'}</p>
              {clientPhone && <p className="text-sm text-slate-600">{clientPhone}</p>}
              {clientEmail && <p className="text-sm text-slate-600">{clientEmail}</p>}
            </div>

            {/* Event Info */}
            <div className="bg-amber-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-amber-700 mb-2">For Event:</h3>
              <p className="text-sm"><strong>Type:</strong> {eventType}</p>
              <p className="text-sm"><strong>Date:</strong> {eventDate ? new Date(eventDate).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC'}</p>
              <p className="text-sm"><strong>Time:</strong> {formattedTime}</p>
              <p className="text-sm"><strong>Venue:</strong> {eventVenue || 'TBC'}</p>
            </div>

            {/* Payment Summary */}
            <div className="border-2 border-slate-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-slate-700 mb-3 pb-2 border-b">Payment Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Amount</span>
                  <span>RM {totalAfterDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Amount Paid</span>
                  <span>RM {depositPaid.toFixed(2)}</span>
                </div>
                {balanceDue > 0 && (
                  <div className="flex justify-between pt-2 border-t text-amber-600">
                    <span>Balance Due</span>
                    <span>RM {balanceDue.toFixed(2)}</span>
                  </div>
                )}
                {balanceDue <= 0 && (
                  <div className="flex justify-between pt-2 border-t text-emerald-600 font-bold">
                    <span>Status</span>
                    <span>✓ PAID IN FULL</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div className="text-center text-sm text-slate-600 mb-6">
              <p>Payment received via: <strong>Bank Transfer / Cash</strong></p>
              <p className="text-xs text-slate-400 mt-1">
                {siteConfig.banking.bank} | {siteConfig.banking.accountNumber}
              </p>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-slate-500 pt-4 border-t border-dashed">
              <p className="font-semibold text-slate-700">{siteConfig.business.name}</p>
              <p>📞 {getPhoneDisplay()} | ✉️ {siteConfig.contact.email}</p>
              <p className="mt-2 text-emerald-600">Thank you for your payment! 🎷</p>
            </div>

            {/* Close button (hidden in print) */}
            <div className="mt-6 text-center print:hidden">
              <button
                onClick={() => setShowReceipt(false)}
                className="bg-slate-600 text-white px-6 py-2 rounded-lg hover:bg-slate-500"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 print:hidden" onClick={() => setShowHistory(false)}>
          <div
            className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-semibold">Invoice History</h2>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Stats Bar */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 sm:px-6 py-3 grid grid-cols-4 gap-2 sm:gap-4 text-white">
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold">{summaryStats.total}</div>
                <div className="text-[10px] sm:text-xs text-slate-400">Records</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold text-emerald-400">RM {summaryStats.collected.toLocaleString()}</div>
                <div className="text-[10px] sm:text-xs text-slate-400">Collected</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold text-amber-400">RM {summaryStats.pending.toLocaleString()}</div>
                <div className="text-[10px] sm:text-xs text-slate-400">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold text-blue-400">RM {summaryStats.deposits.toLocaleString()}</div>
                <div className="text-[10px] sm:text-xs text-slate-400">Deposits</div>
              </div>
            </div>

            {/* Filters Row */}
            <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b space-y-2">
              {/* Year + Search + Sort */}
              <div className="flex gap-2">
                {/* Year Dropdown */}
                <select
                  value={historyYear}
                  onChange={(e) => {
                    setHistoryYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value));
                    resetHistoryPage();
                  }}
                  className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="all">All Years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>

                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search client name..."
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      resetHistoryPage();
                    }}
                    className="w-full pl-9 pr-8 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                  {historySearch && (
                    <button
                      onClick={() => {
                        setHistorySearch('');
                        resetHistoryPage();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Sort */}
                <select
                  value={historySort}
                  onChange={(e) => setHistorySort(e.target.value as typeof historySort)}
                  className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Highest Amount</option>
                  <option value="amount-asc">Lowest Amount</option>
                </select>
              </div>
            </div>

            {/* Status Tabs - Workflow-based */}
            <div className="flex border-b overflow-x-auto">
              {(['all', 'drafts', 'sent', 'deposit', 'paid', 'completed', 'deleted'] as const).map((tab) => {
                const tabLabels: Record<typeof tab, string> = {
                  all: 'All',
                  drafts: 'Drafts',
                  sent: 'Sent',
                  deposit: 'Deposit Rec.',
                  paid: 'Fully Paid',
                  completed: 'Completed',
                  deleted: 'Deleted',
                };
                const tabColors: Record<typeof tab, string> = {
                  all: 'text-amber-600 border-b-2 border-amber-500 bg-amber-50',
                  drafts: 'text-slate-600 border-b-2 border-slate-500 bg-slate-50',
                  sent: 'text-blue-600 border-b-2 border-blue-500 bg-blue-50',
                  deposit: 'text-teal-600 border-b-2 border-teal-500 bg-teal-50',
                  paid: 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50',
                  completed: 'text-purple-600 border-b-2 border-purple-500 bg-purple-50',
                  deleted: 'text-red-600 border-b-2 border-red-500 bg-red-50',
                };
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setHistoryTab(tab);
                      resetHistoryPage();
                    }}
                    className={`flex-shrink-0 py-2.5 px-3 text-sm font-medium transition-colors whitespace-nowrap ${
                      historyTab === tab ? tabColors[tab] : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tabLabels[tab]} ({statusCounts[tab]})
                  </button>
                );
              })}
            </div>

            {/* Invoice List */}
            <div className="flex-1 overflow-y-auto" onClick={() => setHistoryWhatsAppMenu(null)}>
              {filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-lg">No invoices found</p>
                  <p className="text-sm text-center">
                    {historySearch
                      ? `No results for "${historySearch}"`
                      : savedInvoices.length === 0
                      ? 'Create and save your first invoice!'
                      : 'Try adjusting your filters'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {paginatedInvoices.map((invoice) => (
                    <div key={invoice.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              invoice.documentType === 'quotation'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {invoice.documentType === 'quotation' ? 'QUO' : 'INV'}
                            </span>
                            <span className="font-semibold text-slate-800 text-sm">{invoice.invoiceNumber}</span>
                            <select
                              value={invoice.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateInvoiceStatusLocal(invoice.invoiceNumber, e.target.value as StoredInvoice['status'])}
                              className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${
                                isCompletedStatus(invoice.status) ? 'bg-purple-100 text-purple-700' :
                                isFullyPaidStatus(invoice.status) ? 'bg-emerald-100 text-emerald-700' :
                                isPaidStatus(invoice.status) ? 'bg-teal-100 text-teal-700' :
                                isSentStatus(invoice.status) ? 'bg-blue-100 text-blue-700' :
                                invoice.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {/* Quotation statuses */}
                              {invoice.documentType === 'quotation' && (
                                <>
                                  <option value="quotation_draft">Draft</option>
                                  <option value="quotation_sent">Sent</option>
                                </>
                              )}
                              {/* Invoice/common statuses */}
                              {invoice.documentType === 'invoice' && (
                                <>
                                  <option value="deposit_received">Deposit Received</option>
                                  <option value="invoice_sent">Invoice Sent</option>
                                </>
                              )}
                              <option value="balance_paid">Fully Paid</option>
                              <option value="completed">Completed</option>
                              <option value="archived">Archived</option>
                              <option value="cancelled">Cancelled</option>
                              {/* Legacy status options for backward compat */}
                              {(invoice.status === 'draft' || invoice.status === 'sent' || invoice.status === 'paid') && (
                                <>
                                  <option value="draft">Draft (legacy)</option>
                                  <option value="sent">Sent (legacy)</option>
                                  <option value="paid">Paid (legacy)</option>
                                </>
                              )}
                            </select>
                          </div>
                          <p className="text-slate-800 font-medium mt-1 truncate">{invoice.clientName || 'Unnamed Client'}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {invoice.eventDate ? new Date(invoice.eventDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                            </span>
                            {invoice.depositPaid > 0 && (
                              <span className="text-emerald-600">RM {invoice.depositPaid} paid</span>
                            )}
                          </div>
                          {/* Missing info badges - action items */}
                          {(!invoice.clientPhone || !invoice.eventVenue || (invoice.documentType === 'invoice' && !invoice.depositPaid)) && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {!invoice.clientPhone && (
                                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full" title="Missing phone number">
                                  <Phone className="w-3 h-3" />
                                  <span className="hidden sm:inline">No phone</span>
                                </span>
                              )}
                              {!invoice.eventVenue && (
                                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full" title="Missing venue">
                                  <MapPin className="w-3 h-3" />
                                  <span className="hidden sm:inline">No venue</span>
                                </span>
                              )}
                              {invoice.documentType === 'invoice' && !invoice.depositPaid && (
                                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full" title="No deposit paid">
                                  <DollarSign className="w-3 h-3" />
                                  <span className="hidden sm:inline">No deposit</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-3">
                          <div className="font-bold text-amber-600">RM {invoice.total.toFixed(0)}</div>
                          {invoice.status !== 'paid' && invoice.total - invoice.depositPaid > 0 && (
                            <div className="text-xs text-slate-500">
                              Bal: RM {(invoice.total - invoice.depositPaid).toFixed(0)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {historyTab !== 'deleted' ? (
                          <>
                            <button
                              onClick={() => loadInvoice(invoice)}
                              className="flex items-center gap-1.5 text-amber-600 hover:bg-amber-50 py-1.5 px-3 rounded-lg border border-amber-200 text-xs font-medium transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Load
                            </button>
                            <button
                              onClick={async () => {
                                // Load the invoice first, then download with correct filename
                                loadInvoice(invoice);
                                // Wait for render
                                await new Promise(resolve => setTimeout(resolve, 400));
                                handleDownloadPDF(invoice);
                              }}
                              className="flex items-center gap-1.5 text-blue-600 hover:bg-blue-50 py-1.5 px-3 rounded-lg border border-blue-200 text-xs font-medium transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </button>
                            {/* WhatsApp dropdown with templates - only show if phone exists */}
                            {invoice.clientPhone && (
                              <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setHistoryWhatsAppMenu(historyWhatsAppMenu === invoice.invoiceNumber ? null : invoice.invoiceNumber)}
                                  className="flex items-center gap-1.5 text-green-600 hover:bg-green-50 py-1.5 px-3 rounded-lg border border-green-200 text-xs font-medium transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  WhatsApp
                                  <ChevronRight className={`w-3 h-3 transition-transform ${historyWhatsAppMenu === invoice.invoiceNumber ? 'rotate-90' : ''}`} />
                                </button>
                                {historyWhatsAppMenu === invoice.invoiceNumber && (
                                  <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                                    {messageTemplates.map((template) => (
                                      <button
                                        key={template.id}
                                        onClick={() => {
                                          const deposit = Math.round(invoice.total * (siteConfig.terms.depositPercent / 100));
                                          const eventTimeStr = `${invoice.eventTimeHour}:${invoice.eventTimeMinute} ${invoice.eventTimePeriod}`;
                                          const balanceDueDate = invoice.eventDate
                                            ? new Date(new Date(invoice.eventDate).setDate(new Date(invoice.eventDate).getDate() - siteConfig.terms.balanceDueDays)).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                                            : `${siteConfig.terms.balanceDueDays} days before event`;

                                          let message = '';
                                          switch (template.id) {
                                            case 'quotation':
                                              message = generateQuotationMessage({
                                                clientName: invoice.clientName || 'Client',
                                                eventDate: invoice.eventDate || 'TBC',
                                                eventTime: eventTimeStr,
                                                venue: invoice.eventVenue || 'TBC',
                                                packageName: invoice.items[0]?.description || 'Performance Package',
                                                total: invoice.total,
                                                deposit,
                                                invoiceNumber: invoice.invoiceNumber,
                                              });
                                              break;
                                            case 'confirmation':
                                              message = generateConfirmationMessage({
                                                clientName: invoice.clientName || 'Client',
                                                eventDate: invoice.eventDate || 'TBC',
                                                eventTime: eventTimeStr,
                                                venue: invoice.eventVenue || 'TBC',
                                                depositAmount: invoice.depositPaid,
                                                balanceAmount: invoice.total - invoice.depositPaid,
                                              });
                                              break;
                                            case 'balance':
                                              message = generateBalanceReminderMessage({
                                                clientName: invoice.clientName || 'Client',
                                                eventDate: invoice.eventDate || 'TBC',
                                                eventTime: eventTimeStr,
                                                venue: invoice.eventVenue || 'TBC',
                                                balanceAmount: invoice.total - invoice.depositPaid,
                                                dueDate: balanceDueDate,
                                              });
                                              break;
                                            case 'songs':
                                              message = generateSongConfirmationMessage({
                                                clientName: invoice.clientName || 'Client',
                                                eventDate: invoice.eventDate || 'TBC',
                                                currentSongs: invoice.items.map(item => item.description).filter(Boolean),
                                              });
                                              break;
                                            case 'thankyou':
                                              message = generateThankYouMessage({
                                                clientName: invoice.clientName || 'Client',
                                                eventType: invoice.eventType || 'event',
                                                eventDate: invoice.eventDate || 'your special day',
                                              });
                                              break;
                                          }
                                          openWhatsAppWithMessage(invoice.clientPhone, message);
                                          setHistoryWhatsAppMenu(null);
                                        }}
                                        className="w-full text-left px-3 py-2.5 hover:bg-green-50 transition-colors"
                                      >
                                        <div className="text-xs font-medium text-slate-800">{template.name}</div>
                                        <div className="text-[10px] text-slate-500">{template.description}</div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {invoice.status !== 'paid' && (
                              <button
                                onClick={() => updateInvoiceStatusLocal(invoice.invoiceNumber, 'paid')}
                                className="flex items-center gap-1.5 text-emerald-600 hover:bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-200 text-xs font-medium transition-colors"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Mark Paid
                              </button>
                            )}
                            <button
                              onClick={() => deleteInvoice(invoice.invoiceNumber)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                              title="Move to Deleted"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => restoreInvoice(invoice.invoiceNumber)}
                              className="flex items-center gap-1.5 text-emerald-600 hover:bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-200 text-xs font-medium transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Restore
                            </button>
                            <button
                              onClick={() => permanentlyDeleteInvoice(invoice.invoiceNumber)}
                              className="flex items-center gap-1.5 text-red-600 hover:bg-red-50 py-1.5 px-3 rounded-lg border border-red-200 text-xs font-medium transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete Forever
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t flex items-center justify-between">
                <button
                  onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <div className="text-sm text-slate-600">
                  Page <span className="font-semibold">{historyPage}</span> of <span className="font-semibold">{totalPages}</span>
                  <span className="text-slate-400 ml-2">({filteredInvoices.length} items)</span>
                </div>
                <button
                  onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                  disabled={historyPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Panel Footer */}
            <div className="bg-slate-100 px-4 sm:px-6 py-3 border-t text-center text-xs text-slate-500">
              {isGoogleSyncEnabled() ? (
                <span className="flex items-center justify-center gap-1">
                  <Cloud className="w-3 h-3" />
                  Synced with Google Sheets
                  {lastSyncTime && (
                    <span className="text-slate-400 ml-1">
                      • Last sync: {lastSyncTime.toLocaleTimeString()}
                    </span>
                  )}
                </span>
              ) : (
                'Data stored locally in your browser'
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          /* Basic setup - force white background everywhere */
          *, *::before, *::after {
            background-color: transparent !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Main containers - white background */
          body > div,
          .min-h-screen,
          .bg-gray-100 {
            background: white !important;
          }

          /* Hide non-invoice elements entirely */
          body > div > div:first-child, /* header */
          body > div > div:nth-child(2), /* filename bar */
          .print-hidden,
          nav, header, footer {
            display: none !important;
          }

          /* Reset any absolute positioning */
          body, body > div, body > div > div {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
          }

          #invoice-preview {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          #invoice-preview > div {
            background: white !important;
          }

          #invoice-preview > div {
            padding: 5mm !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
          }

          /* Hide form inputs - show only display values */
          #invoice-preview input,
          #invoice-preview select,
          #invoice-preview textarea,
          #invoice-preview button,
          .print-hidden,
          .print\\:hidden {
            display: none !important;
          }

          /* Show print-only elements */
          .hidden.print\\:inline,
          .hidden.print\\:block {
            display: inline !important;
          }
          .print\\:block {
            display: block !important;
          }

          /* Force side-by-side layout for Bill To / Event Details */
          #invoice-preview .grid-cols-1 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 3mm !important;
          }

          /* Compact typography for one page */
          #invoice-preview h1 {
            font-size: 14pt !important;
            margin-bottom: 1mm !important;
          }
          #invoice-preview h2 {
            font-size: 12pt !important;
            margin-bottom: 1mm !important;
          }
          #invoice-preview h3, #invoice-preview h4 {
            font-size: 8pt !important;
            margin-bottom: 1mm !important;
          }
          #invoice-preview p,
          #invoice-preview span {
            font-size: 8pt !important;
            line-height: 1.3 !important;
          }
          #invoice-preview .text-xs,
          #invoice-preview .text-sm {
            font-size: 7pt !important;
          }

          /* Compact table */
          #invoice-preview table {
            font-size: 7pt !important;
          }
          #invoice-preview th {
            padding: 1.5mm 2mm !important;
            font-size: 7pt !important;
            background-color: #1e293b !important;
            color: white !important;
          }
          #invoice-preview td {
            padding: 1.5mm 2mm !important;
            font-size: 7pt !important;
          }

          /* Payment box - keep light background */
          #invoice-preview .bg-slate-50 {
            background-color: #f8fafc !important;
          }

          /* Compact sections */
          #invoice-preview > div > div {
            margin-bottom: 2mm !important;
            padding-bottom: 1mm !important;
          }

          /* Compact lists */
          #invoice-preview ul {
            margin: 0 !important;
            padding-left: 3mm !important;
          }
          #invoice-preview li {
            font-size: 7pt !important;
            line-height: 1.4 !important;
            margin-bottom: 0 !important;
          }

          /* Borders */
          #invoice-preview .border-b-4 {
            border-bottom-width: 1pt !important;
            padding-bottom: 2mm !important;
            margin-bottom: 2mm !important;
          }
          #invoice-preview .border-t {
            padding-top: 1mm !important;
          }

          /* Payment box */
          #invoice-preview .bg-slate-50 {
            padding: 2mm !important;
            margin-bottom: 2mm !important;
          }

          /* Grid spacing */
          #invoice-preview .grid {
            gap: 2mm !important;
          }

          @page {
            size: A4;
            margin: 5mm;
          }

          /* Receipt printing styles - when receipt is visible */
          body:has(#receipt-preview) #invoice-preview,
          body:has(#receipt-preview) .print-hidden,
          body:has(#receipt-preview) .bg-slate-900,
          body:has(#receipt-preview) .bg-slate-800 {
            display: none !important;
          }

          #receipt-preview {
            position: static !important;
            padding: 5mm !important;
            background: white !important;
          }

          #receipt-preview .print\\:hidden {
            display: none !important;
          }

          #receipt-preview button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function InvoiceGenerator() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    }>
      <InvoiceGeneratorContent />
    </Suspense>
  );
}
