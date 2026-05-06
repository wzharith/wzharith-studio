'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Save, RefreshCw, Plus, Trash2, Lock, Eye, EyeOff, Settings, Package, DollarSign, Building2, Phone, Share2, CreditCard, FileText, Truck, Star, FileText as InvoiceIcon, LayoutDashboard, Home, Archive, Calendar, ChevronDown, ChevronUp, Pencil, Layout, Copy } from 'lucide-react';
import Link from 'next/link';
import {
  isStudioApiAvailable,
  fetchConfig,
  saveConfig,
  archiveConfig,
  fetchConfigHistory,
  type SiteConfigData,
  type SiteConfigFeatures,
  type ConfigHistoryEntry,
} from '@/lib/studio-api';
import { clearConfigCache } from '@/lib/cloud-config';
import { isAuthenticated as checkAuth, login as doLogin } from '@/lib/auth';
import { siteConfig } from '@/config/site.config';

interface IncludedSegment {
  name: string;
  quantity: number;
}

interface PackageItem {
  id: string;
  name: string;
  description: string;
  price: number;
  priceDisplay: string;
  priceNote?: string;
  features: string[];
  popular?: boolean;
  songs?: string;
  duration?: string;
  hidden?: boolean;
  includedSegments?: IncludedSegment[];
}

interface AddonItem {
  id: string;
  name: string;
  price: number;
  priceDisplay: string;
  description: string;
}

export default function AdminSettings() {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Config state
  const [config, setConfig] = useState<SiteConfigData>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [lastSavedConfigState, setLastSavedConfigState] = useState<string>('');
  const [lastSavedRestState, setLastSavedRestState] = useState<string>('');
  const [lastSavedPackagesState, setLastSavedPackagesState] = useState<string>('');
  const [lastSavedAddonsState, setLastSavedAddonsState] = useState<string>('');
  const [justSaved, setJustSaved] = useState(false);
  const [sectionSaveType, setSectionSaveType] = useState<'all' | 'rest' | 'packages' | 'addons' | null>(null);

  // Active section
  const [activeSection, setActiveSection] = useState('business');

  // Packages state
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageFilter, setPackageFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  // Collaboration partners state
  const [collaborationPartners, setCollaborationPartners] = useState<string[]>(['Baskara', 'Primadona', 'Skyeglass']);
  const [newPartner, setNewPartner] = useState('');

  // Config history state
  const [configHistory, setConfigHistory] = useState<ConfigHistoryEntry[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveYear, setArchiveYear] = useState(new Date().getFullYear());
  const [showHistory, setShowHistory] = useState(false);

  // Local cache info
  const [localCacheInfo, setLocalCacheInfo] = useState<{ count: number; size: string } | null>(null);

  // Load local cache info
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('studio_invoices');
      if (stored) {
        try {
          const invoices = JSON.parse(stored);
          const sizeKB = (new Blob([stored]).size / 1024).toFixed(1);
          setLocalCacheInfo({ count: invoices.length, size: `${sizeKB} KB` });
        } catch {
          setLocalCacheInfo(null);
        }
      } else {
        setLocalCacheInfo({ count: 0, size: '0 KB' });
      }
    }
  }, []);

  // Clear local cache
  const handleClearCache = () => {
    if (confirm('This will clear all locally cached invoices. Data in Google Sheets will NOT be affected. Continue?')) {
      localStorage.removeItem('studio_invoices');
      setLocalCacheInfo({ count: 0, size: '0 KB' });
      setSaveMessage('Local cache cleared! Refresh dashboard to load fresh data from cloud.');
      setTimeout(() => setSaveMessage(''), 5000);
    }
  };

  // Check authentication (shared auth)
  useEffect(() => {
    let active = true;
    (async () => {
      if (checkAuth()) {
        if (active) setIsAuthenticated(true);
      }
      const { verifyAuthWithServer } = await import('@/lib/auth');
      const ok = await verifyAuthWithServer();
      if (active) {
        setIsAuthenticated(ok);
        setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Stable snapshot of config for change detection (sort keys so comparison is consistent)
  const sortObjectKeys = useCallback((obj: unknown): unknown => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortObjectKeys);
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      sorted[k] = sortObjectKeys((obj as Record<string, unknown>)[k]);
    }
    return sorted;
  }, []);

  const getFullConfig = useCallback((): SiteConfigData & { collaborationPartners?: string[] } => ({
    ...config,
    packages,
    addons,
    collaborationPartners,
  }), [config, packages, addons, collaborationPartners]);

  const currentConfigState = useMemo(
    () => JSON.stringify(sortObjectKeys(getFullConfig())),
    [getFullConfig, sortObjectKeys]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (lastSavedConfigState === '') return true; // allow first save when no snapshot yet
    return currentConfigState !== lastSavedConfigState;
  }, [currentConfigState, lastSavedConfigState]);

  // Rest chunk: everything except packages/addons (for section-level save)
  const getRestChunk = useCallback((): Record<string, unknown> => ({
    ...config,
    collaborationPartners,
  }), [config, collaborationPartners]);

  const currentRestState = useMemo(
    () => JSON.stringify(sortObjectKeys(getRestChunk())),
    [getRestChunk, sortObjectKeys]
  );
  const currentPackagesState = useMemo(
    () => JSON.stringify(sortObjectKeys(packages)),
    [packages, sortObjectKeys]
  );
  const currentAddonsState = useMemo(
    () => JSON.stringify(sortObjectKeys(addons)),
    [addons, sortObjectKeys]
  );

  const hasUnsavedRest = useMemo(() => {
    if (lastSavedRestState === '') return true;
    return currentRestState !== lastSavedRestState;
  }, [currentRestState, lastSavedRestState]);
  const hasUnsavedPackages = useMemo(() => {
    if (lastSavedPackagesState === '') return true;
    return currentPackagesState !== lastSavedPackagesState;
  }, [currentPackagesState, lastSavedPackagesState]);
  const hasUnsavedAddons = useMemo(() => {
    if (lastSavedAddonsState === '') return true;
    return currentAddonsState !== lastSavedAddonsState;
  }, [currentAddonsState, lastSavedAddonsState]);

  // Load config on auth
  useEffect(() => {
    if (isAuthenticated) {
      loadConfig();
      loadConfigHistory();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await doLogin(password);
    if (ok) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  // Default config from site.config.ts
  const getDefaultConfig = (): SiteConfigData => ({
    business_name: siteConfig.business.name,
    business_tagline: siteConfig.business.tagline,
    business_ssm: siteConfig.business.ssm || '',
    contact_phone: siteConfig.contact.phone,
    contact_email: siteConfig.contact.email,
    contact_whatsapp: siteConfig.contact.whatsapp,
    social_instagram: siteConfig.social.instagram || '',
    social_tiktok: siteConfig.social.tiktok || '',
    social_youtube: siteConfig.social.youtube || '',
    social_facebook: siteConfig.social.facebook || '',
    banking_bank: siteConfig.banking.bank,
    banking_accountName: siteConfig.banking.accountName,
    banking_accountNumber: siteConfig.banking.accountNumber,
    transport_baseCharge: siteConfig.transport.zones[0]?.price || 0,
    transport_perKmRate: 0,
    transport_freeZone: siteConfig.transport.baseLocation,
    terms_depositPercent: siteConfig.terms.depositPercent,
    terms_balanceDueDays: siteConfig.terms.balanceDueDays,
    terms_cancellationPolicy: siteConfig.terms.cancellationPolicy,
    terms_latePayment: siteConfig.terms.latePaymentPolicy,
    features: {
      showPortfolio: siteConfig.features.showPortfolio,
      showCollaborators: siteConfig.features.showCollaborators,
      showDigitalProducts: siteConfig.features.showDigitalProducts,
      showProductLaunchNotify: siteConfig.features.showDigitalProducts,
      showSongCatalog: siteConfig.features.showSongCatalog,
    },
  });

  const getDefaultPackages = (): PackageItem[] =>
    siteConfig.packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      price: pkg.price,
      priceDisplay: pkg.priceDisplay,
      priceNote: pkg.priceNote || '',
      features: pkg.features || [],
      popular: pkg.popular || false,
      songs: pkg.songs || '',
      duration: pkg.duration || '',
      hidden: (pkg as { hidden?: boolean }).hidden || false,
      includedSegments: [],
    }));

  const getDefaultAddons = (): AddonItem[] =>
    siteConfig.addons.map((addon, idx) => ({
      id: String(idx + 1),
      name: addon.name,
      price: addon.price,
      priceDisplay: addon.priceDisplay,
      description: addon.description || '',
    }));

  const loadConfig = async () => {
    setIsRefreshing(true);

    const defaultConfig = getDefaultConfig();
    const defaultPackages = getDefaultPackages();
    const defaultAddons = getDefaultAddons();

    if (isStudioApiAvailable()) {
      const result = await fetchConfig();
      const cloudIsEmpty = !result.success || Object.keys(result.config || {}).length === 0;

      if (cloudIsEmpty) {
        // Backend-only: cloud empty = show empty list (no pre-fill from siteConfig)
        console.log('[Admin] Cloud is empty, showing empty packages/addons. Use Import from template to push defaults.');
        setConfig(defaultConfig);
        setPackages([]);
        setAddons([]);
        const partners = ['Baskara', 'Primadona', 'Skyeglass'];
        const fullConfig = { ...defaultConfig, packages: [] as PackageItem[], addons: [] as AddonItem[], collaborationPartners: partners };
        setLastSavedConfigState(JSON.stringify(sortObjectKeys(fullConfig)));
        setLastSavedRestState(JSON.stringify(sortObjectKeys({ ...defaultConfig, collaborationPartners: partners })));
        setLastSavedPackagesState(JSON.stringify(sortObjectKeys([])));
        setLastSavedAddonsState(JSON.stringify(sortObjectKeys([])));
      } else {
        // Smart merge for business/config fields; packages/addons from backend only
        const mergedConfig: SiteConfigData = { ...defaultConfig };
        Object.entries(result.config || {}).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '' && key !== 'packages' && key !== 'addons') {
            (mergedConfig as Record<string, unknown>)[key] = value;
          }
        });
        // Merge features so cloud overrides defaults but we keep all keys
        mergedConfig.features = { ...defaultConfig.features, ...(result.config?.features || {}) };
        setConfig(mergedConfig);

        const cloudPackages = result.config?.packages;
        const cloudAddons = result.config?.addons;

        setPackages(Array.isArray(cloudPackages) ? cloudPackages : []);
        setAddons(Array.isArray(cloudAddons) ? cloudAddons : []);

        const cloudPartners = result.config?.collaborationPartners;
        if (Array.isArray(cloudPartners) && cloudPartners.length > 0) {
          setCollaborationPartners(cloudPartners);
        }
        const partners = Array.isArray(cloudPartners) && cloudPartners.length > 0 ? cloudPartners : ['Baskara', 'Primadona', 'Skyeglass'];
        const fullConfig = {
          ...mergedConfig,
          packages: Array.isArray(cloudPackages) ? cloudPackages : [],
          addons: Array.isArray(cloudAddons) ? cloudAddons : [],
          collaborationPartners: partners,
        };
        setLastSavedConfigState(JSON.stringify(sortObjectKeys(fullConfig)));
        setLastSavedRestState(JSON.stringify(sortObjectKeys({ ...mergedConfig, collaborationPartners: partners })));
        setLastSavedPackagesState(JSON.stringify(sortObjectKeys(Array.isArray(cloudPackages) ? cloudPackages : [])));
        setLastSavedAddonsState(JSON.stringify(sortObjectKeys(Array.isArray(cloudAddons) ? cloudAddons : [])));
      }
    } else {
      // No Google sync: backend-only, show empty
      setConfig(defaultConfig);
      setPackages([]);
      setAddons([]);
      const partners = ['Baskara', 'Primadona', 'Skyeglass'];
      const fullConfig = { ...defaultConfig, packages: [] as PackageItem[], addons: [] as AddonItem[], collaborationPartners: partners };
      setLastSavedConfigState(JSON.stringify(sortObjectKeys(fullConfig)));
      setLastSavedRestState(JSON.stringify(sortObjectKeys({ ...defaultConfig, collaborationPartners: partners })));
      setLastSavedPackagesState(JSON.stringify(sortObjectKeys([])));
      setLastSavedAddonsState(JSON.stringify(sortObjectKeys([])));
    }

    setIsRefreshing(false);
  };

  // Import from template: push site.config packages/addons to backend once (for first-time setup)
  const handleImportFromTemplate = async () => {
    if (!isStudioApiAvailable()) {
      setSaveMessage('Google sync not configured. Cannot import.');
      setTimeout(() => setSaveMessage(''), 4000);
      return;
    }
    const defaultConfig = getDefaultConfig();
    const defaultPackages = getDefaultPackages();
    const defaultAddons = getDefaultAddons();
    const fullDefaults = {
      ...defaultConfig,
      packages: defaultPackages,
      addons: defaultAddons,
    };
    const res = await saveConfig(fullDefaults);
    if (res.success) {
      clearConfigCache();
      await loadConfig();
      setSaveMessage('Template imported. Packages and addons loaded from template.');
    } else {
      setSaveMessage('Import failed: ' + (res.error || 'Unknown error'));
    }
    setTimeout(() => setSaveMessage(''), 5000);
  };

  // Load config history
  const loadConfigHistory = async () => {
    if (isStudioApiAvailable()) {
      const result = await fetchConfigHistory();
      if (result.success) {
        setConfigHistory(result.history);
      }
    }
  };

  // Archive current config
  const handleArchive = async () => {
    setIsArchiving(true);
    const result = await archiveConfig(archiveYear);
    if (result.success) {
      setSaveMessage(`Config archived for ${archiveYear}!`);
      loadConfigHistory(); // Refresh history
    } else {
      setSaveMessage('Error: ' + (result.error || 'Failed to archive'));
    }
    setIsArchiving(false);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSectionSaveType('all');
    setSaveMessage('');

    const fullConfig = {
      ...config,
      packages,
      addons,
      collaborationPartners,
    };

    const result = await saveConfig(fullConfig);

    if (result.success) {
      setSaveMessage('Settings saved successfully!');
      setLastSavedConfigState(JSON.stringify(sortObjectKeys(fullConfig)));
      setLastSavedRestState(JSON.stringify(sortObjectKeys(getRestChunk())));
      setLastSavedPackagesState(JSON.stringify(sortObjectKeys(packages)));
      setLastSavedAddonsState(JSON.stringify(sortObjectKeys(addons)));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      clearConfigCache();
    } else {
      setSaveMessage('Error: ' + (result.error || 'Failed to save'));
    }

    setIsSaving(false);
    setSectionSaveType(null);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleSaveRest = async () => {
    if (!isStudioApiAvailable()) return;
    setIsSaving(true);
    setSectionSaveType('rest');
    setSaveMessage('');
    const restChunk = getRestChunk() as SiteConfigData;
    const result = await saveConfig(restChunk);
    if (result.success) {
      setSaveMessage('Settings saved!');
      setLastSavedRestState(JSON.stringify(sortObjectKeys(restChunk)));
      clearConfigCache();
    } else {
      setSaveMessage('Error: ' + (result.error || 'Failed to save'));
    }
    setIsSaving(false);
    setSectionSaveType(null);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleSavePackages = async () => {
    if (!isStudioApiAvailable()) return;
    setIsSaving(true);
    setSectionSaveType('packages');
    setSaveMessage('');
    const result = await saveConfig({ packages });
    if (result.success) {
      setSaveMessage('Packages saved!');
      setLastSavedPackagesState(JSON.stringify(sortObjectKeys(packages)));
      clearConfigCache();
    } else {
      setSaveMessage('Error: ' + (result.error || 'Failed to save'));
    }
    setIsSaving(false);
    setSectionSaveType(null);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleSaveAddons = async () => {
    if (!isStudioApiAvailable()) return;
    setIsSaving(true);
    setSectionSaveType('addons');
    setSaveMessage('');
    const result = await saveConfig({ addons });
    if (result.success) {
      setSaveMessage('Add-ons saved!');
      setLastSavedAddonsState(JSON.stringify(sortObjectKeys(addons)));
      clearConfigCache();
    } else {
      setSaveMessage('Error: ' + (result.error || 'Failed to save'));
    }
    setIsSaving(false);
    setSectionSaveType(null);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const updateConfig = (key: keyof SiteConfigData, value: string | number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateFeature = (key: keyof SiteConfigFeatures, value: boolean) => {
    setConfig(prev => ({
      ...prev,
      features: { ...(prev.features || {}), [key]: value },
    }));
  };

  // Package management
  const addPackage = () => {
    const newId = Date.now().toString();
    setPackages([...packages, {
      id: newId,
      name: '',
      description: '',
      price: 0,
      priceDisplay: 'RM 0',
      priceNote: '',
      features: [],
      popular: false,
      songs: '',
      duration: '1 hour',
      hidden: false,
      includedSegments: [],
    }]);
  };

  const updatePackage = (id: string, field: keyof PackageItem, value: string | number | boolean | string[] | IncludedSegment[]) => {
    setPackages(packages.map(pkg => {
      if (pkg.id !== id) return pkg;

      const updated = { ...pkg, [field]: value };

      // Auto-update priceDisplay when price changes
      if (field === 'price') {
        updated.priceDisplay = `RM ${Number(value).toLocaleString()}`;
      }

      return updated;
    }));
  };

  const addPackageSegment = (pkgId: string) => {
    setPackages(packages.map(pkg => {
      if (pkg.id !== pkgId) return pkg;
      const segs = pkg.includedSegments ?? [];
      return { ...pkg, includedSegments: [...segs, { name: '', quantity: 1 }] };
    }));
  };

  const removePackageSegment = (pkgId: string, index: number) => {
    setPackages(packages.map(pkg => {
      if (pkg.id !== pkgId) return pkg;
      const segs = (pkg.includedSegments ?? []).filter((_, i) => i !== index);
      return { ...pkg, includedSegments: segs };
    }));
  };

  const updatePackageSegment = (pkgId: string, index: number, field: 'name' | 'quantity', value: string | number) => {
    setPackages(packages.map(pkg => {
      if (pkg.id !== pkgId) return pkg;
      const segs = [...(pkg.includedSegments ?? [])];
      if (!segs[index]) return pkg;
      segs[index] = { ...segs[index], [field]: field === 'quantity' ? Number(value) : value };
      return { ...pkg, includedSegments: segs };
    }));
  };

  const removePackage = (id: string) => {
    setPackages(packages.filter(pkg => pkg.id !== id));
    if (editingPackageId === id) setEditingPackageId(null);
  };

  const duplicatePackage = (sourceId: string) => {
    const source = packages.find(pkg => pkg.id === sourceId);
    if (!source) return;
    const newId = Date.now().toString();
    const copy: PackageItem = {
      ...source,
      id: newId,
      name: (source.name || '').trim() ? `${source.name} (copy)` : source.name,
    };
    setPackages([...packages, copy]);
    setEditingPackageId(newId);
  };

  const filteredPackages = useMemo(() => {
    if (packageFilter === 'visible') return packages.filter(pkg => !pkg.hidden);
    if (packageFilter === 'hidden') return packages.filter(pkg => pkg.hidden === true);
    return packages;
  }, [packages, packageFilter]);

  // Addon management
  const addAddon = () => {
    setAddons([...addons, {
      id: Date.now().toString(),
      name: '',
      price: 0,
      priceDisplay: 'RM 0',
      description: '',
    }]);
  };

  const updateAddon = (id: string, field: keyof AddonItem, value: string | number) => {
    setAddons(addons.map(addon => {
      if (addon.id !== id) return addon;

      const updated = { ...addon, [field]: value };

      // Auto-update priceDisplay when price changes
      if (field === 'price') {
        updated.priceDisplay = `RM ${Number(value).toLocaleString()}`;
      }

      return updated;
    }));
  };

  const removeAddon = (id: string) => {
    setAddons(addons.filter(addon => addon.id !== id));
  };

  // Sections
  const sections = [
    { id: 'business', label: 'Business', icon: Building2 },
    { id: 'contact', label: 'Contact', icon: Phone },
    { id: 'social', label: 'Social', icon: Share2 },
    { id: 'banking', label: 'Banking', icon: CreditCard },
    { id: 'packages', label: 'Packages', icon: Package },
    { id: 'addons', label: 'Add-ons', icon: DollarSign },
    { id: 'collaborations', label: 'Collaborations', icon: Star },
    { id: 'transport', label: 'Transport', icon: Truck },
    { id: 'terms', label: 'Terms', icon: FileText },
    { id: 'modules', label: 'Modules', icon: Layout },
    { id: 'sync', label: 'Sync', icon: RefreshCw },
  ];

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
              <Settings className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Admin Settings</h1>
          <p className="text-slate-500 text-center mb-6">Enter password to access settings</p>

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
              Access Settings
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

  // Main admin panel
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-slate-900 text-white py-4 px-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-400" />
              Admin Settings
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
                <InvoiceIcon className="w-3 h-3" />
                Invoice
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
          <div className="flex items-center gap-3">
            {!isStudioApiAvailable() && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                Google Sync Not Configured
              </span>
            )}
            <button
              onClick={loadConfig}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isStudioApiAvailable() || (!hasUnsavedChanges && !justSaved && lastSavedConfigState !== '')}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-500 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {isSaving && sectionSaveType === 'all' ? 'Saving...' : justSaved ? 'Saved!' : 'Save all'}
            </button>
          </div>
        </div>
      </header>

      {/* Save message */}
      {saveMessage && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg ${
          saveMessage.includes('Error') ? 'bg-red-500' : 'bg-emerald-500'
        } text-white`}>
          {saveMessage}
        </div>
      )}

      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-48 flex-shrink-0">
            <nav className="bg-white rounded-xl shadow-sm overflow-hidden">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-amber-50 text-amber-600 border-l-4 border-amber-500'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <section.icon className="w-4 h-4" />
                  {section.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
            {/* Loading overlay */}
            {isRefreshing && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                <span className="ml-3 text-slate-500">Loading configuration...</span>
              </div>
            )}

            {!isRefreshing && (
              <>
            {/* Business Section */}
            {activeSection === 'business' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-800">Business Information</h2>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      value={config.business_name || ''}
                      onChange={(e) => updateConfig('business_name', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., WZHarith Studio"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tagline</label>
                    <input
                      type="text"
                      value={config.business_tagline || ''}
                      onChange={(e) => updateConfig('business_tagline', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., Live Saxophone Performance Services"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">SSM Registration</label>
                    <input
                      type="text"
                      value={config.business_ssm || ''}
                      onChange={(e) => updateConfig('business_ssm', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., 202603015121 (KT0606402-U)"
                    />
                  </div>
                </div>
                {isStudioApiAvailable() && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveRest}
                      disabled={!hasUnsavedRest || isSaving}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving && sectionSaveType === 'rest' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Contact Section */}
            {activeSection === 'contact' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-800">Contact Information</h2>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={config.contact_phone || ''}
                      onChange={(e) => updateConfig('contact_phone', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., +60174047441"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={config.contact_email || ''}
                      onChange={(e) => updateConfig('contact_email', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., hello@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Number (without +)</label>
                    <input
                      type="text"
                      value={config.contact_whatsapp || ''}
                      onChange={(e) => updateConfig('contact_whatsapp', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., 60174047441"
                    />
                  </div>
                </div>
                {isStudioApiAvailable() && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveRest}
                      disabled={!hasUnsavedRest || isSaving}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving && sectionSaveType === 'rest' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Social Media Section */}
            {activeSection === 'social' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-800">Social Media</h2>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Instagram Username</label>
                    <input
                      type="text"
                      value={config.social_instagram || ''}
                      onChange={(e) => updateConfig('social_instagram', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., wzharith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">TikTok Username</label>
                    <input
                      type="text"
                      value={config.social_tiktok || ''}
                      onChange={(e) => updateConfig('social_tiktok', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., wzharithh"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">YouTube Username</label>
                    <input
                      type="text"
                      value={config.social_youtube || ''}
                      onChange={(e) => updateConfig('social_youtube', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., wzharith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Facebook Page</label>
                    <input
                      type="text"
                      value={config.social_facebook || ''}
                      onChange={(e) => updateConfig('social_facebook', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., wzharithstudio"
                    />
                  </div>
                </div>
                {isStudioApiAvailable() && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveRest}
                      disabled={!hasUnsavedRest || isSaving}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving && sectionSaveType === 'rest' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Banking Section */}
            {activeSection === 'banking' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-800">Banking Details</h2>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={config.banking_bank || ''}
                      onChange={(e) => updateConfig('banking_bank', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., Maybank"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      value={config.banking_accountName || ''}
                      onChange={(e) => updateConfig('banking_accountName', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., WZHARITH STUDIO"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={config.banking_accountNumber || ''}
                      onChange={(e) => updateConfig('banking_accountNumber', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., 5686 0312 0447"
                    />
                  </div>
                </div>
                {isStudioApiAvailable() && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveRest}
                      disabled={!hasUnsavedRest || isSaving}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving && sectionSaveType === 'rest' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Packages Section */}
            {activeSection === 'packages' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-lg font-semibold text-slate-800">Service Packages</h2>
                  <div className="flex items-center gap-2">
                    {isStudioApiAvailable() && (
                      <>
                        <button
                          type="button"
                          onClick={handleSavePackages}
                          disabled={!hasUnsavedPackages || isSaving}
                          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:opacity-60 text-white px-3 py-2 rounded-lg text-sm font-medium"
                        >
                          <Save className="w-4 h-4" />
                          {isSaving && sectionSaveType === 'packages' ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={handleImportFromTemplate}
                          className="flex items-center gap-2 bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-300"
                        >
                          <FileText className="w-4 h-4" />
                          Import from template
                        </button>
                      </>
                    )}
                    <button
                      onClick={addPackage}
                      className="flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-amber-600"
                    >
                      <Plus className="w-4 h-4" />
                      Add Package
                    </button>
                  </div>
                </div>
                {packages.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Show:</span>
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                      {(['all', 'visible', 'hidden'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setPackageFilter(f)}
                          className={`px-3 py-1.5 text-sm font-medium capitalize ${
                            packageFilter === f ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {f === 'all' ? 'All' : f === 'visible' ? 'Visible' : 'Hidden'}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-slate-500">
                      {packageFilter === 'all' && `${packages.length} total`}
                      {packageFilter === 'visible' && `${filteredPackages.length} visible`}
                      {packageFilter === 'hidden' && `${filteredPackages.length} hidden`}
                    </span>
                  </div>
                )}
                <div className="space-y-3">
                  {packages.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No packages yet. Click &quot;Add Package&quot; to create one, or &quot;Import from template&quot; to load defaults from site config.</p>
                  ) : filteredPackages.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No packages match the current filter. Change filter or add a package.</p>
                  ) : (
                    filteredPackages.map((pkg, index) => (
                      <div key={pkg.id} className="border rounded-lg overflow-hidden hover:border-amber-300 transition-colors">
                        {/* Compact row: name, price, duration, songs, badges, Edit, Delete */}
                        <div className="flex items-center justify-between gap-4 p-4 bg-white">
                          <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                            <span className="font-medium text-slate-800">{pkg.name || 'Untitled'}</span>
                            <span className="text-amber-600 font-semibold">RM {pkg.price}</span>
                            {pkg.duration && <span className="text-slate-500 text-sm">{pkg.duration}</span>}
                            {pkg.songs && <span className="text-slate-500 text-sm">{pkg.songs}</span>}
                            {pkg.popular && (
                              <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                                <Star className="w-3 h-3" /> Popular
                              </span>
                            )}
                            {pkg.hidden && (
                              <span className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                                <EyeOff className="w-3 h-3" /> Hidden
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingPackageId(editingPackageId === pkg.id ? null : pkg.id)}
                              className="flex items-center gap-1 px-2 py-1.5 text-slate-600 hover:bg-slate-100 rounded text-sm"
                            >
                              <Pencil className="w-4 h-4" />
                              {editingPackageId === pkg.id ? 'Cancel' : 'Edit'}
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicatePackage(pkg.id)}
                              className="flex items-center gap-1 px-2 py-1.5 text-slate-600 hover:bg-slate-100 rounded text-sm"
                              title="Duplicate package"
                            >
                              <Copy className="w-4 h-4" />
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => removePackage(pkg.id)}
                              className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {/* Expandable detail form */}
                        {editingPackageId === pkg.id && (
                          <div className="border-t border-slate-200 bg-slate-50 p-4 grid gap-3">
                            <input
                              type="text"
                              value={pkg.name}
                              onChange={(e) => updatePackage(pkg.id, 'name', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                              placeholder="Package Name (e.g., Full Package)"
                            />
                            <textarea
                              value={pkg.description}
                              onChange={(e) => updatePackage(pkg.id, 'description', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 h-16"
                              placeholder="Short description..."
                            />
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Price (RM)</label>
                                <input
                                  type="number"
                                  value={pkg.price}
                                  onChange={(e) => updatePackage(pkg.id, 'price', Number(e.target.value))}
                                  className="w-full px-3 py-2 border rounded-lg"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Duration</label>
                                <input
                                  type="text"
                                  value={pkg.duration || ''}
                                  onChange={(e) => updatePackage(pkg.id, 'duration', e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg"
                                  placeholder="e.g., 1-1.5 hours"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Songs</label>
                                <input
                                  type="text"
                                  value={pkg.songs || ''}
                                  onChange={(e) => updatePackage(pkg.id, 'songs', e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg"
                                  placeholder="e.g., 5-6 songs"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Price Note (optional)</label>
                              <input
                                type="text"
                                value={pkg.priceNote || ''}
                                onChange={(e) => updatePackage(pkg.id, 'priceNote', e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="e.g., starting from"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Features (one per line)</label>
                              <textarea
                                value={(pkg.features || []).join('\n')}
                                onChange={(e) => updatePackage(pkg.id, 'features', e.target.value.split('\n').map(f => f.trim()).filter(Boolean))}
                                className="w-full px-3 py-2 border rounded-lg h-24 font-mono text-sm"
                                placeholder="One feature per line&#10;e.g. Entrance performance&#10;Cake cutting&#10;Background music"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Included segments</label>
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <button
                                  type="button"
                                  onClick={() => addPackageSegment(pkg.id)}
                                  className="flex items-center gap-1 px-2 py-1.5 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300"
                                >
                                  <Plus className="w-3 h-3" /> Add segment
                                </button>
                              </div>
                              <div className="space-y-2">
                                {(pkg.includedSegments ?? []).map((seg, segIdx) => (
                                  <div key={segIdx} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={seg.name}
                                      onChange={(e) => updatePackageSegment(pkg.id, segIdx, 'name', e.target.value)}
                                      className="flex-1 px-2 py-1.5 border rounded text-sm"
                                      placeholder="Segment name"
                                    />
                                    <input
                                      type="number"
                                      min={1}
                                      value={seg.quantity}
                                      onChange={(e) => updatePackageSegment(pkg.id, segIdx, 'quantity', e.target.value)}
                                      className="w-16 px-2 py-1.5 border rounded text-sm text-right"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removePackageSegment(pkg.id, segIdx)}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={pkg.popular || false}
                                  onChange={(e) => updatePackage(pkg.id, 'popular', e.target.checked)}
                                  className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                                />
                                <span className="text-sm text-slate-600">Mark as Popular</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={pkg.hidden || false}
                                  onChange={(e) => updatePackage(pkg.id, 'hidden', e.target.checked)}
                                  className="w-4 h-4 text-slate-500 rounded focus:ring-slate-500"
                                />
                                <span className="text-sm text-slate-600 flex items-center gap-1">
                                  <EyeOff className="w-3 h-3" />
                                  Hidden from website
                                </span>
                              </label>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingPackageId(null)}
                              className="w-full sm:w-auto px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
                            >
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Add-ons Section */}
            {activeSection === 'addons' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-lg font-semibold text-slate-800">Add-on Services</h2>
                  <div className="flex items-center gap-2">
                    {isStudioApiAvailable() && (
                      <button
                        type="button"
                        onClick={handleSaveAddons}
                        disabled={!hasUnsavedAddons || isSaving}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:opacity-60 text-white px-3 py-2 rounded-lg text-sm font-medium"
                      >
                        <Save className="w-4 h-4" />
                        {isSaving && sectionSaveType === 'addons' ? 'Saving...' : 'Save'}
                      </button>
                    )}
                    <button
                      onClick={addAddon}
                      className="flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-amber-600"
                    >
                      <Plus className="w-4 h-4" />
                      Add Item
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {addons.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No add-ons yet. Click &quot;Add Item&quot; to create one.</p>
                  ) : (
                    addons.map((addon) => (
                      <div key={addon.id} className="border rounded-lg p-4 hover:border-amber-300 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 grid gap-3">
                            {/* Row 1: Name and Price */}
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2">
                                <label className="block text-xs text-slate-500 mb-1">Name</label>
                                <input
                                  type="text"
                                  value={addon.name}
                                  onChange={(e) => updateAddon(addon.id, 'name', e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                                  placeholder="e.g., Custom Song Request"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Price (RM)</label>
                                <input
                                  type="number"
                                  value={addon.price}
                                  onChange={(e) => updateAddon(addon.id, 'price', Number(e.target.value))}
                                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                                />
                              </div>
                            </div>
                            {/* Row 2: Description */}
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Description</label>
                              <input
                                type="text"
                                value={addon.description}
                                onChange={(e) => updateAddon(addon.id, 'description', e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                                placeholder="Brief description of this add-on..."
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => removeAddon(addon.id)}
                            className="text-red-400 hover:text-red-600 p-2 mt-6"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Collaborations Section */}
            {activeSection === 'collaborations' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800">Collaboration Partners</h2>
                </div>
                <p className="text-sm text-slate-500">
                  Manage your collaboration partners. These will appear as options when selecting &quot;Collaboration&quot; as the lead source.
                </p>

                {/* Add new partner */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPartner}
                    onChange={(e) => setNewPartner(e.target.value)}
                    placeholder="Enter partner name..."
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPartner.trim()) {
                        setCollaborationPartners([...collaborationPartners, newPartner.trim()]);
                        setNewPartner('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newPartner.trim()) {
                        setCollaborationPartners([...collaborationPartners, newPartner.trim()]);
                        setNewPartner('');
                      }
                    }}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>

                {/* Partners list */}
                <div className="space-y-2">
                  {collaborationPartners.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No collaboration partners added yet</p>
                  ) : (
                    collaborationPartners.map((partner, index) => (
                      <div key={index} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <Star className="w-5 h-5 text-amber-500" />
                          <span className="font-medium text-slate-800">{partner}</span>
                        </div>
                        <button
                          onClick={() => setCollaborationPartners(collaborationPartners.filter((_, i) => i !== index))}
                          className="text-red-400 hover:text-red-600 p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {isStudioApiAvailable() && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveRest}
                      disabled={!hasUnsavedRest || isSaving}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving && sectionSaveType === 'rest' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Transport Section */}
            {activeSection === 'transport' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-800">Transport Rates</h2>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Base Charge (RM)</label>
                    <input
                      type="number"
                      value={config.transport_baseCharge || 0}
                      onChange={(e) => updateConfig('transport_baseCharge', Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., 50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Per KM Rate (RM)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.transport_perKmRate || 0}
                      onChange={(e) => updateConfig('transport_perKmRate', Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., 1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Free Zone (no transport charge)</label>
                    <input
                      type="text"
                      value={config.transport_freeZone || ''}
                      onChange={(e) => updateConfig('transport_freeZone', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., Cyberjaya, Putrajaya"
                    />
                  </div>
                </div>
                {isStudioApiAvailable() && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveRest}
                      disabled={!hasUnsavedRest || isSaving}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving && sectionSaveType === 'rest' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Terms Section */}
            {activeSection === 'terms' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-800">Terms & Conditions</h2>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Deposit Percentage (%)</label>
                    <input
                      type="number"
                      value={config.terms_depositPercent || 30}
                      onChange={(e) => updateConfig('terms_depositPercent', Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., 30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Balance Due Days (before event)</label>
                    <input
                      type="number"
                      value={config.terms_balanceDueDays || 3}
                      onChange={(e) => updateConfig('terms_balanceDueDays', Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g., 3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cancellation Policy</label>
                    <textarea
                      value={config.terms_cancellationPolicy || ''}
                      onChange={(e) => updateConfig('terms_cancellationPolicy', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 h-24"
                      placeholder="Enter your cancellation policy..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Late Payment Terms</label>
                    <textarea
                      value={config.terms_latePayment || ''}
                      onChange={(e) => updateConfig('terms_latePayment', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 h-24"
                      placeholder="Enter late payment terms..."
                    />
                  </div>
                </div>
                {isStudioApiAvailable() && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveRest}
                      disabled={!hasUnsavedRest || isSaving}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving && sectionSaveType === 'rest' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Modules (Feature flags) Section */}
            {activeSection === 'modules' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-800">Site Modules</h2>
                <p className="text-sm text-slate-500">
                  Turn sections on or off on the main site. Changes apply when using cloud config.
                </p>
                <div className="space-y-4">
                  {[
                    { key: 'showPortfolio' as const, label: 'Recent Performances', description: 'Portfolio / past performances section' },
                    { key: 'showCollaborators' as const, label: 'Collaborations', description: 'Collaboration partners section' },
                    { key: 'showDigitalProducts' as const, label: 'Digital Products', description: 'Digital products (coming soon) section' },
                    { key: 'showProductLaunchNotify' as const, label: 'Get Notified When Products Launch', description: 'Signup block inside Digital Products' },
                    { key: 'showSongCatalog' as const, label: 'Repertoire (Song Catalog)', description: 'Song list / repertoire section' },
                  ].map(({ key, label, description }) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <p className="font-medium text-slate-800">{label}</p>
                        <p className="text-sm text-slate-500">{description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.features?.[key] !== false}
                          onChange={(e) => updateFeature(key, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                        <span className="ms-3 text-sm font-medium text-slate-700">
                          {config.features?.[key] !== false ? 'On' : 'Off'}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
                {isStudioApiAvailable() && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveRest}
                      disabled={!hasUnsavedRest || isSaving}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving && sectionSaveType === 'rest' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sync Section */}
            {activeSection === 'sync' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-800">Configuration Sync</h2>
                <p className="text-sm text-slate-500">
                  Sync configuration between Google Sheets and your static site files.
                </p>

                {/* Archive Config */}
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Archive className="w-5 h-5 text-amber-600" />
                    <h3 className="font-medium text-amber-800">Archive Current Config</h3>
                  </div>
                  <p className="text-sm text-amber-700 mb-3">
                    Save a snapshot of your current packages and pricing for historical reference.
                    Useful when changing prices for a new year.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-amber-700">Year:</label>
                      <select
                        value={archiveYear}
                        onChange={(e) => setArchiveYear(Number(e.target.value))}
                        className="px-3 py-2 border border-amber-300 rounded-lg bg-white text-amber-800"
                      >
                        {[2024, 2025, 2026, 2027].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleArchive}
                      disabled={isArchiving || !isStudioApiAvailable()}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <Archive className="w-4 h-4" />
                      {isArchiving ? 'Archiving...' : 'Archive Now'}
                    </button>
                  </div>
                </div>

                {/* Config History */}
                <div className="bg-white rounded-lg p-4 border">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-slate-600" />
                      <h3 className="font-medium text-slate-700">Config History</h3>
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                        {configHistory.length} snapshots
                      </span>
                    </div>
                    {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showHistory && (
                    <div className="mt-4 space-y-3">
                      {configHistory.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">
                          No archived configs yet. Archive your first snapshot above.
                        </p>
                      ) : (
                        configHistory.map((entry) => (
                          <div key={entry.year} className="border rounded-lg p-3 hover:border-amber-300 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-slate-800">{entry.year}</span>
                              <span className="text-xs text-slate-500">
                                Archived: {new Date(entry.archivedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="text-slate-600">
                                <span className="font-medium">{entry.packages.length}</span> packages
                              </div>
                              <div className="text-slate-600">
                                <span className="font-medium">{entry.addons.length}</span> add-ons
                              </div>
                            </div>
                            {entry.packages.length > 0 && (
                              <div className="mt-2 text-xs text-slate-500">
                                Packages: {entry.packages.map(p => `${p.name} (RM${p.price})`).join(', ')}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Clear Local Cache */}
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Trash2 className="w-5 h-5 text-red-600" />
                    <h3 className="font-medium text-red-800">Clear Local Cache</h3>
                  </div>
                  <p className="text-sm text-red-700 mb-3">
                    Clear locally cached invoices in your browser. Use this if your local data is out of sync with Google Sheets.
                    This does NOT delete any data from Google Sheets.
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-red-600">
                      {localCacheInfo ? (
                        <span>Local cache: <strong>{localCacheInfo.count}</strong> invoices ({localCacheInfo.size})</span>
                      ) : (
                        <span>No local cache detected</span>
                      )}
                    </div>
                    <button
                      onClick={handleClearCache}
                      disabled={!localCacheInfo || localCacheInfo.count === 0}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear Cache
                    </button>
                  </div>
                </div>

                {/* Current Status */}
                <div className="bg-slate-50 rounded-lg p-4 border">
                  <h3 className="font-medium text-slate-700 mb-2">Current Data Flow</h3>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      <span><strong>Admin & Invoice:</strong> Read/Write from Google Sheets (cloud)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                      <span><strong>Main Site:</strong> Uses site.config.ts (static, fast)</span>
                    </div>
                  </div>
                </div>

                {/* Pull from Cloud */}
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-medium text-slate-700 mb-2">Pull from Cloud to site.config.ts</h3>
                  <p className="text-sm text-slate-500 mb-3">
                    To update your static site with the latest cloud config, run this command in your terminal:
                  </p>
                  <div className="bg-slate-900 text-emerald-400 px-4 py-3 rounded-lg font-mono text-sm flex items-center justify-between">
                    <code>npm run sync:pull</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('npm run sync:pull');
                        setSaveMessage('Command copied!');
                        setTimeout(() => setSaveMessage(''), 2000);
                      }}
                      className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-800 rounded"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Then run <code className="bg-slate-100 px-1 rounded">npm run build</code> and deploy to update your public site.
                  </p>
                </div>

                {/* Cloud sync info */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-medium text-blue-800 mb-2">Cloud sync</h3>
                  <p className="text-sm text-blue-700">
                    Packages, addons, and business config sync directly with Postgres via this app&apos;s
                    API. Changes saved here are visible on the public site within seconds (cached for 5
                    minutes per browser).
                  </p>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
