#!/usr/bin/env npx ts-node

/**
 * Sync Config Script
 *
 * Pull the latest configuration from Google Sheets and update site.config.ts
 *
 * Usage:
 *   npm run sync:pull
 *
 * This script will:
 * 1. Fetch config from Google Sheets
 * 2. Update the packages and addons sections in site.config.ts
 * 3. Preserve the rest of the file structure
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
  console.log('✅ Loaded environment from .env.local');
}

// Google Apps Script URL (must be set in environment)
const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || '';

interface CloudPackage {
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
}

interface CloudAddon {
  id: string;
  name: string;
  price: number;
  priceDisplay: string;
  description: string;
}

interface CloudConfig {
  packages?: CloudPackage[];
  addons?: CloudAddon[];
  business_name?: string;
  business_tagline?: string;
  business_ssm?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_whatsapp?: string;
  social_instagram?: string;
  social_tiktok?: string;
  social_youtube?: string;
  social_facebook?: string;
  banking_bank?: string;
  banking_accountName?: string;
  banking_accountNumber?: string;
}

async function fetchConfigFromCloud(): Promise<CloudConfig | null> {
  if (!GOOGLE_SCRIPT_URL) {
    console.error('❌ NEXT_PUBLIC_GOOGLE_SCRIPT_URL is not set');
    console.error('   Set it in your .env.local file');
    return null;
  }

  try {
    console.log('📡 Fetching config from Google Sheets...');
    const url = `${GOOGLE_SCRIPT_URL}?action=getConfig`;

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success && data.config) {
      console.log('✅ Config fetched successfully');
      return data.config;
    } else {
      console.error('❌ Invalid response from cloud');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to fetch config:', error);
    return null;
  }
}

function formatPackage(pkg: CloudPackage): string {
  const features = pkg.features.map(f => `        "${f}",`).join('\n');

  let output = `    {
      id: "${pkg.id}",
      name: "${pkg.name}",
      price: ${pkg.price},
      priceDisplay: "${pkg.priceDisplay}",`;

  if (pkg.priceNote) {
    output += `\n      priceNote: "${pkg.priceNote}",`;
  }

  output += `
      description: "${pkg.description.replace(/"/g, '\\"')}",
      features: [
${features}
      ],`;

  if (pkg.popular) {
    output += `\n      popular: true,`;
  }
  if (pkg.songs) {
    output += `\n      songs: "${pkg.songs}",`;
  }
  if (pkg.duration) {
    output += `\n      duration: "${pkg.duration}",`;
  }

  output += `\n    }`;
  return output;
}

function formatAddon(addon: CloudAddon): string {
  return `    {
      name: "${addon.name}",
      price: ${addon.price},
      priceDisplay: "${addon.priceDisplay}",
      description: "${addon.description.replace(/"/g, '\\"')}",
    }`;
}

function updateSiteConfig(config: CloudConfig): boolean {
  const configPath = path.join(__dirname, '../src/config/site.config.ts');

  if (!fs.existsSync(configPath)) {
    console.error('❌ site.config.ts not found at:', configPath);
    return false;
  }

  let content = fs.readFileSync(configPath, 'utf-8');

  // Update packages section
  if (config.packages && config.packages.length > 0) {
    console.log(`📦 Updating ${config.packages.length} packages...`);

    const packagesContent = config.packages.map(formatPackage).join(',\n');

    // Replace packages array using regex
    const packagesRegex = /(packages:\s*\[)[\s\S]*?(\],\s*\n\s*\/\/ Add-ons)/;
    const packagesReplacement = `$1\n${packagesContent},\n  $2`;

    if (packagesRegex.test(content)) {
      content = content.replace(packagesRegex, packagesReplacement);
    } else {
      console.warn('⚠️  Could not find packages section to update');
    }
  }

  // Update addons section
  if (config.addons && config.addons.length > 0) {
    console.log(`🔧 Updating ${config.addons.length} add-ons...`);

    const addonsContent = config.addons.map(formatAddon).join(',\n');

    // Replace addons array using regex
    const addonsRegex = /(addons:\s*\[)[\s\S]*?(\],\s*\n\s*\/\/ Transport)/;
    const addonsReplacement = `$1\n${addonsContent},\n  $2`;

    if (addonsRegex.test(content)) {
      content = content.replace(addonsRegex, addonsReplacement);
    } else {
      console.warn('⚠️  Could not find addons section to update');
    }
  }

  // Write updated content
  fs.writeFileSync(configPath, content, 'utf-8');
  console.log('✅ site.config.ts updated successfully');

  return true;
}

async function main() {
  console.log('\n🔄 WZHarith Studio - Config Sync (Pull)\n');
  console.log('━'.repeat(50));

  // Fetch from cloud
  const config = await fetchConfigFromCloud();

  if (!config) {
    console.log('\n❌ Sync failed. Please check your configuration.\n');
    process.exit(1);
  }

  // Show what we got
  console.log('\n📊 Cloud Config Summary:');
  console.log(`   Packages: ${config.packages?.length || 0}`);
  console.log(`   Add-ons: ${config.addons?.length || 0}`);

  // Update site.config.ts
  console.log('\n📝 Updating site.config.ts...');
  const success = updateSiteConfig(config);

  if (success) {
    console.log('\n✨ Sync complete! Your site.config.ts is now up to date.');
    console.log('   Run `npm run build` to rebuild with the new config.\n');
  } else {
    console.log('\n❌ Sync failed. Please check the errors above.\n');
    process.exit(1);
  }
}

main().catch(console.error);
