'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchConfig, isGoogleSyncEnabled, type SiteConfigData } from './google-sync';
import { siteConfig } from '@/config/site.config';

const CACHE_KEY = 'wzharith_cloud_config';
const CACHE_EXPIRY_KEY = 'wzharith_cloud_config_expiry';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Feature flag to control whether main site uses cloud config or static file
 *
 * Set in .env.local:
 *   NEXT_PUBLIC_USE_CLOUD_CONFIG=true   -> Use Google Sheets (slower, always latest)
 *   NEXT_PUBLIC_USE_CLOUD_CONFIG=false  -> Use site.config.ts (instant, requires deploy)
 *
 * Default: false (static file)
 */
export const useCloudConfigEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_USE_CLOUD_CONFIG === 'true';
};

/**
 * Check if cloud config is enabled (non-hook version for SSR)
 */
export const isCloudConfigEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_USE_CLOUD_CONFIG === 'true';
};

export interface CloudPackage {
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
}

export interface CloudAddon {
  id: string;
  name: string;
  price: number;
  priceDisplay: string;
  description: string;
}

export interface CloudConfigState {
  packages: CloudPackage[];
  addons: CloudAddon[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Get cached config from sessionStorage
 */
const getCachedConfig = (): SiteConfigData | null => {
  if (typeof window === 'undefined') return null;

  try {
    const expiry = sessionStorage.getItem(CACHE_EXPIRY_KEY);
    if (expiry && Date.now() > parseInt(expiry)) {
      // Cache expired
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(CACHE_EXPIRY_KEY);
      return null;
    }

    const cached = sessionStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

/**
 * Save config to sessionStorage cache
 */
const setCachedConfig = (config: SiteConfigData): void => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(config));
    sessionStorage.setItem(CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Clear the config cache (call this after saving in admin)
 */
export const clearConfigCache = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CACHE_KEY);
  sessionStorage.removeItem(CACHE_EXPIRY_KEY);
};

/**
 * Get default packages from site.config.ts (static file)
 */
export const getDefaultPackages = (): CloudPackage[] =>
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
    hidden: pkg.hidden || false,
  }));

/**
 * Get default addons from site.config.ts (static file)
 */
export const getDefaultAddons = (): CloudAddon[] =>
  siteConfig.addons.map((addon, idx) => ({
    id: String(idx + 1),
    name: addon.name,
    price: addon.price,
    priceDisplay: addon.priceDisplay,
    description: addon.description || '',
  }));

/**
 * Hook to fetch packages and addons from Google Sheets with caching
 *
 * Usage:
 * const { packages, addons, isLoading, error, refresh } = useCloudConfig();
 */
export const useCloudConfig = (): CloudConfigState => {
  const [packages, setPackages] = useState<CloudPackage[]>([]);
  const [addons, setAddons] = useState<CloudAddon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadConfig = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCachedConfig();
      if (cached) {
        console.log('[CloudConfig] Using cached config');
        setPackages(cached.packages || getDefaultPackages());
        setAddons(cached.addons || getDefaultAddons());
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      }
    }

    // Fetch from cloud if enabled
    if (isGoogleSyncEnabled()) {
      try {
        console.log('[CloudConfig] Fetching from cloud...');
        const result = await fetchConfig();

        if (result.success && result.config) {
          const cloudPackages = result.config.packages;
          const cloudAddons = result.config.addons;

          const pkgs = Array.isArray(cloudPackages) && cloudPackages.length > 0
            ? cloudPackages
            : getDefaultPackages();
          const adds = Array.isArray(cloudAddons) && cloudAddons.length > 0
            ? cloudAddons
            : getDefaultAddons();

          setPackages(pkgs);
          setAddons(adds);

          // Cache the result
          setCachedConfig({
            ...result.config,
            packages: pkgs,
            addons: adds,
          });

          setLastUpdated(new Date());
          console.log('[CloudConfig] Loaded from cloud:', { packages: pkgs.length, addons: adds.length });
        } else {
          // Cloud failed, use defaults
          console.log('[CloudConfig] Cloud fetch failed, using defaults');
          setPackages(getDefaultPackages());
          setAddons(getDefaultAddons());
          setError('Could not load from cloud, using defaults');
        }
      } catch (err) {
        console.error('[CloudConfig] Error:', err);
        setPackages(getDefaultPackages());
        setAddons(getDefaultAddons());
        setError('Failed to fetch config');
      }
    } else {
      // Google sync not enabled, use defaults
      console.log('[CloudConfig] Google sync not enabled, using defaults');
      setPackages(getDefaultPackages());
      setAddons(getDefaultAddons());
    }

    setIsLoading(false);
  }, []);

  // Load on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const refresh = useCallback(async () => {
    await loadConfig(true);
  }, [loadConfig]);

  return {
    packages,
    addons,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
};
