'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, RefreshCw, Plus, Trash2, Lock, Eye, EyeOff, Settings, Package, DollarSign, Building2, Phone, Share2, CreditCard, FileText, Truck } from 'lucide-react';
import Link from 'next/link';
import {
  isGoogleSyncEnabled,
  fetchConfig,
  saveConfigToGoogle,
  type SiteConfigData,
} from '@/lib/google-sync';

// Password from environment variable
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_INVOICE_PASSWORD || 'taktahu';

interface PackageItem {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
}

interface AddonItem {
  id: string;
  name: string;
  price: number;
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

  // Active section
  const [activeSection, setActiveSection] = useState('business');

  // Packages state
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [addons, setAddons] = useState<AddonItem[]>([]);

  // Check authentication
  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  // Load config on auth
  useEffect(() => {
    if (isAuthenticated) {
      loadConfig();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  const loadConfig = async () => {
    setIsRefreshing(true);
    const result = await fetchConfig();
    if (result.success) {
      setConfig(result.config);
      setPackages(result.config.packages || []);
      setAddons(result.config.addons || []);
    }
    setIsRefreshing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    // Include packages and addons in config
    const fullConfig = {
      ...config,
      packages,
      addons,
    };

    const result = await saveConfigToGoogle(fullConfig);

    if (result.success) {
      setSaveMessage('Settings saved successfully!');
    } else {
      setSaveMessage('Error: ' + (result.error || 'Failed to save'));
    }

    setIsSaving(false);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const updateConfig = (key: keyof SiteConfigData, value: string | number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Package management
  const addPackage = () => {
    setPackages([...packages, {
      id: Date.now().toString(),
      name: '',
      description: '',
      price: 0,
      duration: '1 hour',
    }]);
  };

  const updatePackage = (id: string, field: keyof PackageItem, value: string | number) => {
    setPackages(packages.map(pkg =>
      pkg.id === id ? { ...pkg, [field]: value } : pkg
    ));
  };

  const removePackage = (id: string) => {
    setPackages(packages.filter(pkg => pkg.id !== id));
  };

  // Addon management
  const addAddon = () => {
    setAddons([...addons, {
      id: Date.now().toString(),
      name: '',
      price: 0,
    }]);
  };

  const updateAddon = (id: string, field: keyof AddonItem, value: string | number) => {
    setAddons(addons.map(addon =>
      addon.id === id ? { ...addon, [field]: value } : addon
    ));
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
    { id: 'transport', label: 'Transport', icon: Truck },
    { id: 'terms', label: 'Terms', icon: FileText },
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
            <Link href="/" className="text-amber-400 hover:text-amber-300">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-400" />
              Admin Settings
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {!isGoogleSyncEnabled() && (
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
              disabled={isSaving || !isGoogleSyncEnabled()}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-500 px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
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
              </div>
            )}

            {/* Packages Section */}
            {activeSection === 'packages' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800">Service Packages</h2>
                  <button
                    onClick={addPackage}
                    className="flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-amber-600"
                  >
                    <Plus className="w-4 h-4" />
                    Add Package
                  </button>
                </div>
                <div className="space-y-4">
                  {packages.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No packages yet. Click "Add Package" to create one.</p>
                  ) : (
                    packages.map((pkg, index) => (
                      <div key={pkg.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-slate-500">Package {index + 1}</span>
                          <button
                            onClick={() => removePackage(pkg.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid gap-3">
                          <input
                            type="text"
                            value={pkg.name}
                            onChange={(e) => updatePackage(pkg.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="Package Name"
                          />
                          <input
                            type="text"
                            value={pkg.description}
                            onChange={(e) => updatePackage(pkg.id, 'description', e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="Description"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="number"
                              value={pkg.price}
                              onChange={(e) => updatePackage(pkg.id, 'price', Number(e.target.value))}
                              className="w-full px-3 py-2 border rounded-lg"
                              placeholder="Price (RM)"
                            />
                            <input
                              type="text"
                              value={pkg.duration}
                              onChange={(e) => updatePackage(pkg.id, 'duration', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg"
                              placeholder="Duration"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Add-ons Section */}
            {activeSection === 'addons' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800">Add-on Services</h2>
                  <button
                    onClick={addAddon}
                    className="flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-amber-600"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {addons.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No add-ons yet. Click "Add Item" to create one.</p>
                  ) : (
                    addons.map((addon) => (
                      <div key={addon.id} className="flex items-center gap-3 border rounded-lg p-3">
                        <input
                          type="text"
                          value={addon.name}
                          onChange={(e) => updateAddon(addon.id, 'name', e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-lg"
                          placeholder="Add-on Name"
                        />
                        <div className="w-32">
                          <input
                            type="number"
                            value={addon.price}
                            onChange={(e) => updateAddon(addon.id, 'price', Number(e.target.value))}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="Price"
                          />
                        </div>
                        <button
                          onClick={() => removeAddon(addon.id)}
                          className="text-red-400 hover:text-red-600 p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
