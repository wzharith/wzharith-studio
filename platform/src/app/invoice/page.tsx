'use client';

import { useState, useEffect } from 'react';
import { Printer, ArrowLeft, Plus, Trash2, Lock, Eye, EyeOff, Percent, Save, History, X, FileText, Calendar, ChevronRight, Cloud, CloudOff, RefreshCw, MessageCircle, Send, Receipt, CheckCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { siteConfig, getPhoneDisplay } from '@/config/site.config';
import {
  saveInvoiceToGoogle,
  createCalendarEvent,
  syncAllInvoices,
  isGoogleSyncEnabled,
  type StoredInvoice as GoogleStoredInvoice
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

// Password from environment variable (set in GitHub Secrets)
// Falls back to default if not set
const INVOICE_PASSWORD = process.env.NEXT_PUBLIC_INVOICE_PASSWORD || 'taktahu';

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
  depositPaid: number;
  total: number;
  createdAt: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  linkedQuotationNumber?: string; // Original quotation number when converted to invoice
  convertedAt?: string; // When quotation was converted to invoice
}

export default function InvoiceGenerator() {
  // Password state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Prevent flash
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // History panel
  const [showHistory, setShowHistory] = useState(false);
  const [savedInvoices, setSavedInvoices] = useState<StoredInvoice[]>([]);

  // Track currently loaded invoice for updates
  const [currentLoadedId, setCurrentLoadedId] = useState<string | null>(null);
  const [linkedQuotationNumber, setLinkedQuotationNumber] = useState<string | null>(null);

  // Check if already authenticated (session storage)
  useEffect(() => {
    const auth = sessionStorage.getItem('invoice_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false); // Done checking
  }, []);

  // Load saved invoices from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSavedInvoices(JSON.parse(stored));
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === INVOICE_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('invoice_auth', 'true');
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  // Document type
  const [documentType, setDocumentType] = useState<'quotation' | 'invoice'>('quotation');
  const [showReceipt, setShowReceipt] = useState(false);

  // Invoice details
  const [invoiceNumber, setInvoiceNumber] = useState(`QUO-${new Date().getFullYear()}-001`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);

  // Update number prefix when type changes
  const updateDocumentNumber = (type: 'quotation' | 'invoice') => {
    const prefix = type === 'quotation' ? 'QUO' : 'INV';
    const currentNum = invoiceNumber.split('-').pop() || '001';
    setInvoiceNumber(`${prefix}-${new Date().getFullYear()}-${currentNum}`);
    setDocumentType(type);
  };

  // Client details
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');

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
  const [depositPaid, setDepositPaid] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const discountAmount = discountType === 'percent' ? (subtotal * discount / 100) : discount;
  const totalAfterDiscount = subtotal - discountAmount;
  const balanceDue = totalAfterDiscount - depositPaid;

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

  // Generate filename for PDF (uses only - as separator)
  const generateFilename = () => {
    const dateStr = eventDate || new Date().toISOString().split('T')[0];
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

  // Save invoice to localStorage
  const saveInvoice = (status: StoredInvoice['status'] = 'draft') => {
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
      depositPaid,
      total: totalAfterDiscount,
      createdAt: new Date().toISOString(),
      status,
      linkedQuotationNumber: linkedQuotationNumber || undefined,
      convertedAt: linkedQuotationNumber ? new Date().toISOString() : undefined,
    };

    // Check if updating existing by ID or creating new
    const existingIndex = currentLoadedId
      ? savedInvoices.findIndex(inv => inv.id === currentLoadedId)
      : savedInvoices.findIndex(inv => inv.invoiceNumber === invoiceNumber);

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
      saveInvoiceToGoogle(invoice as GoogleStoredInvoice)
        .then(() => console.log('Synced to Google Sheets'))
        .catch((err) => console.error('Google sync failed:', err));
    }

    alert(`${documentType === 'quotation' ? 'Quotation' : 'Invoice'} saved!`);
  };

  // Convert quotation to invoice (updates same record, no duplicate)
  const convertToInvoice = () => {
    if (documentType !== 'quotation') return;

    const originalQuoNumber = invoiceNumber;
    const numPart = invoiceNumber.split('-').pop() || '001';
    const newInvoiceNumber = `INV-${new Date().getFullYear()}-${numPart}`;

    setLinkedQuotationNumber(originalQuoNumber);
    setInvoiceNumber(newInvoiceNumber);
    setDocumentType('invoice');
    setInvoiceDate(new Date().toISOString().split('T')[0]);

    // Auto-set deposit as paid (client confirmed)
    setDepositPaid(Math.round(totalAfterDiscount * (siteConfig.terms.depositPercent / 100)));
  };

  // Start new document (clear form)
  const startNew = () => {
    const prefix = 'QUO';
    // Find highest number used
    const existingNumbers = savedInvoices
      .filter(inv => inv.invoiceNumber.startsWith(prefix))
      .map(inv => parseInt(inv.invoiceNumber.split('-').pop() || '0'));
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    setDocumentType('quotation');
    setInvoiceNumber(`${prefix}-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
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
    setDepositPaid(0);
    setCurrentLoadedId(null);
    setLinkedQuotationNumber(null);
  };

  // Load invoice from history
  const loadInvoice = (invoice: StoredInvoice) => {
    setCurrentLoadedId(invoice.id);
    setLinkedQuotationNumber(invoice.linkedQuotationNumber || null);
    setDocumentType(invoice.documentType);
    setInvoiceNumber(invoice.invoiceNumber);
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
    setDepositPaid(invoice.depositPaid);
    setShowHistory(false);
  };

  // Delete invoice from history
  const deleteInvoice = (id: string) => {
    if (confirm('Delete this record?')) {
      const updated = savedInvoices.filter(inv => inv.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSavedInvoices(updated);
    }
  };

  // Update invoice status
  const updateInvoiceStatusLocal = (id: string, status: StoredInvoice['status']) => {
    const updated = savedInvoices.map(inv =>
      inv.id === id ? { ...inv, status } : inv
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSavedInvoices(updated);

    // Sync status to Google
    const invoice = savedInvoices.find(inv => inv.id === id);
    if (invoice && isGoogleSyncEnabled()) {
      import('@/lib/google-sync').then(({ updateInvoiceStatus: updateGoogleStatus }) => {
        updateGoogleStatus(invoice.invoiceNumber, status);
      });
    }
  };

  // Package presets (from config)
  const packagePresets = siteConfig.packages.map(pkg => ({
    name: pkg.name,
    price: pkg.price,
    details: pkg.description,
    setDeposit: true,
  }));

  // Add-on presets (from config)
  const addOnPresets = siteConfig.addons.map(addon => ({
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

  const handleSyncToGoogle = async () => {
    if (!isGoogleSyncEnabled()) {
      alert('Google sync is not configured. Set NEXT_PUBLIC_GOOGLE_SCRIPT_URL in your environment.');
      return;
    }

    setIsSyncing(true);
    try {
      await syncAllInvoices(savedInvoices as GoogleStoredInvoice[]);
      alert('Successfully synced all data to Google Sheets!');
    } catch (error) {
      alert('Sync failed. Check console for details.');
      console.error(error);
    } finally {
      setIsSyncing(false);
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
    } catch (error) {
      alert('Failed to create calendar event.');
      console.error(error);
    }
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
              <Link href="/" className="flex items-center gap-1 sm:gap-2 text-amber-400 hover:text-amber-300 text-sm">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Site</span>
              </Link>
              <h1 className="text-base sm:text-xl font-semibold">
                {documentType === 'quotation' ? 'Quotation' : 'Invoice'}
              </h1>
            </div>
            {/* Desktop buttons */}
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
                History ({savedInvoices.length})
              </button>
              <button
                onClick={handleSyncToGoogle}
                disabled={isSyncing || !isGoogleSyncEnabled()}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                  isGoogleSyncEnabled()
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
                title={isGoogleSyncEnabled() ? 'Sync all to Google Sheets' : 'Google sync not configured'}
              >
                {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : isGoogleSyncEnabled() ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
                {isSyncing ? 'Syncing...' : 'Sync'}
              </button>
              {GOOGLE_SHEET_URL && (
                <a
                  href={GOOGLE_SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors text-sm"
                  title="View inquiries & invoices in Google Sheets"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Sheets
                </a>
              )}
              {eventDate && clientName && isGoogleSyncEnabled() && (
                <button
                  onClick={handleCreateCalendarEvent}
                  className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors text-sm"
                  title="Create calendar event with reminders"
                >
                  <Calendar className="w-4 h-4" />
                  Add to Calendar
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
              {documentType === 'quotation' && items.length > 0 && (
                <button
                  onClick={convertToInvoice}
                  className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-400 transition-colors text-sm"
                >
                  <FileText className="w-4 h-4" />
                  Convert to Invoice
                </button>
              )}
              <button
                onClick={() => saveInvoice('draft')}
                className="flex items-center gap-2 bg-emerald-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-emerald-400 transition-colors text-sm"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-amber-500 text-slate-900 px-3 py-2 rounded-lg font-medium hover:bg-amber-400 transition-colors text-sm"
              >
                <Printer className="w-4 h-4" />
                Print / PDF
              </button>
              {depositPaid > 0 && (
                <button
                  onClick={handlePrintReceipt}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-emerald-500 transition-colors text-sm"
                  title="Print payment receipt"
                >
                  <Receipt className="w-4 h-4" />
                  Receipt
                </button>
              )}
            </div>
          </div>
          {/* Mobile buttons - scrollable row */}
          <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={startNew}
              className="flex-shrink-0 flex items-center gap-1 bg-slate-700 text-white px-2 py-1.5 rounded-lg font-medium text-xs"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="flex-shrink-0 flex items-center gap-1 bg-slate-700 text-white px-2 py-1.5 rounded-lg font-medium text-xs"
            >
              <History className="w-3 h-3" />
              {savedInvoices.length}
            </button>
            {documentType === 'quotation' && items.length > 0 && (
              <button
                onClick={convertToInvoice}
                className="flex-shrink-0 flex items-center gap-1 bg-blue-500 text-white px-2 py-1.5 rounded-lg font-medium text-xs"
              >
                <FileText className="w-3 h-3" />
                Convert
              </button>
            )}
            <button
              onClick={() => saveInvoice('draft')}
              className="flex-shrink-0 flex items-center gap-1 bg-emerald-500 text-white px-2 py-1.5 rounded-lg font-medium text-xs"
            >
              <Save className="w-3 h-3" />
              Save
            </button>
            <button
              onClick={handlePrint}
              className="flex-shrink-0 flex items-center gap-1 bg-amber-500 text-slate-900 px-2 py-1.5 rounded-lg font-medium text-xs"
            >
              <Printer className="w-3 h-3" />
              PDF
            </button>
          </div>
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
                {documentType === 'invoice' && (
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Deposit Paid (RM)</label>
                    <input
                      type="number"
                      value={depositPaid}
                      onChange={(e) => setDepositPaid(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">{siteConfig.terms.depositPercent}% of total = RM {(totalAfterDiscount * (siteConfig.terms.depositPercent / 100)).toFixed(2)}</p>
                  </div>
                )}
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
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider">Description</th>
                      <th className="text-center py-3 px-4 text-xs uppercase tracking-wider w-16">Qty</th>
                      <th className="text-right py-3 px-4 text-xs uppercase tracking-wider w-24">Rate</th>
                      <th className="text-right py-3 px-4 text-xs uppercase tracking-wider w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-200">
                        <td className="py-4 px-4">
                          <div className="print:hidden flex items-start gap-2">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                placeholder="Service description"
                                className="w-full font-medium text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-amber-500 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={item.details}
                                onChange={(e) => updateItem(item.id, 'details', e.target.value)}
                                placeholder="Additional details"
                                className="w-full text-sm text-slate-500 border-b border-transparent hover:border-slate-300 focus:border-amber-500 focus:outline-none"
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
                            <div className="font-medium text-slate-800">{item.description}</div>
                            {item.details && <div className="text-sm text-slate-500">{item.details}</div>}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                            className="w-12 text-center border rounded px-1 py-1 print:hidden"
                          />
                          <span className="hidden print:inline">{item.quantity}</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(item.id, 'rate', Number(e.target.value))}
                            className="w-20 text-right border rounded px-1 py-1 print:hidden"
                          />
                          <span className="hidden print:inline">{item.rate}</span>
                        </td>
                        <td className="py-4 px-4 text-right font-medium">
                          RM {(item.quantity * item.rate).toFixed(2)}
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

              {/* Totals */}
              <div className="print-section flex justify-end mb-4 sm:mb-8">
                <div className="w-full sm:w-72">
                  <div className="flex justify-between py-2 border-b border-slate-200">
                    <span className="text-slate-600">Subtotal</span>
                    <span>RM {subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between py-2 border-b border-slate-200 text-green-600">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        Discount {discountType === 'percent' ? `(${discount}%)` : ''}
                      </span>
                      <span>- RM {discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between py-2 border-b border-slate-200">
                      <span className="text-slate-600">Total</span>
                      <span>RM {totalAfterDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {documentType === 'invoice' && (
                    <>
                      <div className="flex justify-between py-2 border-b border-slate-200">
                        <span className="text-slate-600">Deposit Paid</span>
                        <span>- RM {depositPaid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b-4 border-amber-500 font-bold text-lg">
                        <span>Balance Due</span>
                        <span className={balanceDue < 0 ? 'text-green-600' : ''}>
                          RM {balanceDue.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                  {documentType === 'quotation' && (
                    <>
                      <div className="flex justify-between py-3 border-b-4 border-amber-500 font-bold text-lg">
                        <span>Total Estimated</span>
                        <span>RM {totalAfterDiscount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-2 text-sm text-slate-500">
                        <span>Deposit Required ({siteConfig.terms.depositPercent}%)</span>
                        <span>RM {(totalAfterDiscount * (siteConfig.terms.depositPercent / 100)).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Info - Keep together with terms */}
              <div className="print-keep-together">
                <div className="bg-slate-50 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-slate-200 print:bg-gray-50 print:border-gray-300">
                  <h3 className="text-xs uppercase tracking-wider text-amber-600 font-semibold mb-2 sm:mb-3">Payment Details</h3>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                    <p><strong>Bank:</strong> {siteConfig.banking.bank}</p>
                    <p><strong>Account Name:</strong> {siteConfig.banking.accountName}</p>
                    <p><strong>Account No:</strong> {siteConfig.banking.accountNumber}</p>
                    <p><strong>Reference:</strong> {eventDate ? eventDate.replace(/-/g, '') : 'BOOKING'}-{(clientName || 'CLIENT').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 3)}</p>
                  </div>
                </div>

                {/* Terms */}
                <div className="text-xs text-slate-500 mb-4 sm:mb-6">
                  <h4 className="font-semibold text-slate-700 mb-2">Terms & Conditions</h4>
                {documentType === 'quotation' ? (
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>This quotation is valid for <strong>{siteConfig.terms.quotationValidDays} days</strong> from the date above</li>
                    <li><strong>Payment:</strong> {siteConfig.terms.paymentMethods}</li>
                    <li><strong>{siteConfig.terms.depositPercent}% deposit</strong> required to confirm your booking</li>
                    <li>Balance due by <strong className="text-amber-600">{formattedBalanceDueDate}</strong>. {siteConfig.terms.latePaymentPolicy}</li>
                    <li>Transport charges apply for venues outside {siteConfig.transport.baseLocation}</li>
                  </ul>
                ) : (
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><strong>Payment:</strong> {siteConfig.terms.paymentMethods}</li>
                    <li><strong>Deposit:</strong> {siteConfig.terms.depositPercent}% deposit required to confirm booking</li>
                    <li><strong>Balance:</strong> Full payment due by <strong className="text-amber-600">{formattedBalanceDueDate}</strong></li>
                    <li><strong>Late Payment:</strong> {siteConfig.terms.latePaymentPolicy}</li>
                    <li><strong>Cancellation:</strong> {siteConfig.terms.cancellationPolicy}</li>
                    <li><strong>Rescheduling:</strong> {siteConfig.terms.reschedulingPolicy}</li>
                  </ul>
                )}
                </div>
              </div>

              {/* Footer */}
              <div className="print-section text-center text-xs text-slate-500 pt-3 sm:pt-4 border-t border-slate-200">
                <p className="font-semibold text-slate-700">{siteConfig.business.name}</p>
                <p>📞 {getPhoneDisplay()} | ✉️ {siteConfig.contact.email}{siteConfig.social.instagram ? ` | 📸 @${siteConfig.social.instagram}` : ''}</p>
                <p className="mt-1 sm:mt-2 text-amber-600">Thank you for your business! 🎷</p>
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
            className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
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

            {/* Stats Summary */}
            <div className="bg-slate-50 px-6 py-4 border-b grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-800">{savedInvoices.length}</div>
                <div className="text-xs text-slate-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {savedInvoices.filter(i => i.status === 'paid').length}
                </div>
                <div className="text-xs text-slate-500">Paid</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">
                  RM {savedInvoices.reduce((sum, inv) => sum + inv.total, 0).toLocaleString()}
                </div>
                <div className="text-xs text-slate-500">Total Value</div>
              </div>
            </div>

            {/* Invoice List */}
            <div className="flex-1 overflow-y-auto">
              {savedInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-lg">No saved invoices yet</p>
                  <p className="text-sm">Create and save your first invoice!</p>
                </div>
              ) : (
                <div className="divide-y">
                  {savedInvoices.map((invoice) => (
                    <div key={invoice.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              invoice.documentType === 'quotation'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {invoice.documentType === 'quotation' ? 'QUO' : 'INV'}
                            </span>
                            <span className="font-semibold text-slate-800">{invoice.invoiceNumber}</span>
                          </div>
                          <p className="text-slate-600 font-medium mt-1">{invoice.clientName || 'Unnamed Client'}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-amber-600">RM {invoice.total.toFixed(2)}</div>
                          <select
                            value={invoice.status}
                            onChange={(e) => updateInvoiceStatusLocal(invoice.id, e.target.value as StoredInvoice['status'])}
                            className={`text-xs mt-1 px-2 py-1 rounded-full border-0 font-medium ${
                              invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                              invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                              invoice.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="paid">Paid</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {invoice.eventDate ? new Date(invoice.eventDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                        </span>
                        <span>{invoice.eventType}</span>
                        {invoice.linkedQuotationNumber && (
                          <span className="text-blue-500">
                            ← from {invoice.linkedQuotationNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadInvoice(invoice)}
                          className="flex-1 flex items-center justify-center gap-2 text-amber-600 hover:bg-amber-50 py-2 px-3 rounded-lg border border-amber-200 text-sm font-medium transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                          Load & Edit
                        </button>
                        <button
                          onClick={() => deleteInvoice(invoice.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t text-center text-xs text-slate-500">
              Data stored locally in your browser
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
        }
      `}</style>
    </div>
  );
}
