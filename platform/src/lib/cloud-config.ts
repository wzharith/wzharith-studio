'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchConfig, type SiteConfigData, type SiteConfigFeatures } from './studio-api';
import { siteConfig } from '@/config/site.config';

/** Resolved feature flags for the main site (with defaults) */
export interface ResolvedFeatures {
  showPortfolio: boolean;
  showCollaborators: boolean;
  showDigitalProducts: boolean;
  showProductLaunchNotify: boolean;
  showSongCatalog: boolean;
}

const defaultFeatures = (): ResolvedFeatures => ({
  showPortfolio: siteConfig.features.showPortfolio,
  showCollaborators: siteConfig.features.showCollaborators,
  showDigitalProducts: siteConfig.features.showDigitalProducts,
  showProductLaunchNotify: siteConfig.features.showDigitalProducts,
  showSongCatalog: siteConfig.features.showSongCatalog,
});

const CACHE_KEY = 'wzharith_cloud_config';
const CACHE_EXPIRY_KEY = 'wzharith_cloud_config_expiry';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Cloud config is now the only source of truth (Neon Postgres via /api/config).
 * The legacy `NEXT_PUBLIC_USE_CLOUD_CONFIG` flag is gone; these helpers always
 * return true and remain only for backward compatibility with consumers.
 */
export const useCloudConfigEnabled = (): boolean => true;
export const isCloudConfigEnabled = (): boolean => true;

export interface IncludedSegment {
  name: string;
  quantity: number;
}

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
  includedSegments?: IncludedSegment[];
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
 * Hook to fetch packages and addons from Neon (`/api/config`) with caching
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
        setPackages(Array.isArray(cached.packages) ? cached.packages : []);
        setAddons(Array.isArray(cached.addons) ? cached.addons : []);
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      }
    }

    try {
      const result = await fetchConfig();

      if (result.success && result.config) {
        const cloudPackages = result.config.packages;
        const cloudAddons = result.config.addons;

        const pkgs = Array.isArray(cloudPackages) ? cloudPackages : [];
        const adds = Array.isArray(cloudAddons) ? cloudAddons : [];

        setPackages(pkgs);
        setAddons(adds);

        setCachedConfig({
          ...result.config,
          packages: pkgs,
          addons: adds,
        });

        setLastUpdated(new Date());
      } else {
        setPackages([]);
        setAddons([]);
        setError(result.error || 'Could not load config from /api/config.');
      }
    } catch (err) {
      console.error('[CloudConfig] Error:', err);
      setPackages([]);
      setAddons([]);
      setError('Failed to fetch config');
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

/**
 * Resolve features from cloud config (when cloud enabled) or static site config.
 * Use on the main site to respect admin-controlled module toggles.
 */
export const useCloudConfigFeatures = (): ResolvedFeatures => {
  const [features, setFeatures] = useState<ResolvedFeatures>(defaultFeatures);

  useEffect(() => {
    const defaults = defaultFeatures();
    const apply = (f: Partial<SiteConfigFeatures> | undefined) => {
      setFeatures({
        showPortfolio: f?.showPortfolio ?? defaults.showPortfolio,
        showCollaborators: f?.showCollaborators ?? defaults.showCollaborators,
        showDigitalProducts: f?.showDigitalProducts ?? defaults.showDigitalProducts,
        showProductLaunchNotify: f?.showProductLaunchNotify ?? defaults.showProductLaunchNotify,
        showSongCatalog: f?.showSongCatalog ?? defaults.showSongCatalog,
      });
    };
    const cached = getCachedConfig();
    if (cached?.features) {
      apply(cached.features as Partial<SiteConfigFeatures>);
      return;
    }
    fetchConfig().then((result) => {
      apply(result.success && result.config?.features ? (result.config.features as Partial<SiteConfigFeatures>) : undefined);
    });
  }, []);

  return features;
};
