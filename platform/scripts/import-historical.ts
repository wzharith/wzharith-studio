/**
 * Import Historical Records Script
 *
 * Scans Archive folder and matches with user-provided monthly data
 * to create invoice records in Google Sheets.
 *
 * Usage:
 *   npm run import:preview   # Generate preview CSV
 *   npm run import:push      # Push to Google Sheets
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from platform directory
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
const ARCHIVE_PATH = path.resolve(__dirname, '../../Archive');

// =============================================================================
// HISTORICAL DATA FROM USER
// Package A = RM 500, Package B = RM 900
// =============================================================================

interface MonthlyData {
  packageA: number;
  packageB: number;
  packageC: number;
  adjustment: number;
}

interface YearlyData {
  [month: number]: MonthlyData;
}

const HISTORICAL_DATA: { [year: number]: YearlyData } = {
  2024: {
    5: { packageA: 0, packageB: 1, packageC: 0, adjustment: -400 }, // May
    6: { packageA: 3, packageB: 0, packageC: 0, adjustment: -500 }, // Jun
    7: { packageA: 1, packageB: 1, packageC: 0, adjustment: -425 }, // Jul
    8: { packageA: 3, packageB: 0, packageC: 0, adjustment: -800 }, // Aug
    9: { packageA: 1, packageB: 0, packageC: 0, adjustment: -500 }, // Sep
    10: { packageA: 1, packageB: 0, packageC: 0, adjustment: 0 },   // Oct
    11: { packageA: 2, packageB: 1, packageC: 0, adjustment: -100 }, // Nov
  },
  2025: {
    2: { packageA: 1, packageB: 0, packageC: 0, adjustment: -500 },  // Feb
    4: { packageA: 1, packageB: 0, packageC: 0, adjustment: 0 },     // Apr
    5: { packageA: 3, packageB: 0, packageC: 0, adjustment: 0 },     // May
    6: { packageA: 1, packageB: 0, packageC: 0, adjustment: 0 },     // Jun
    7: { packageA: 0, packageB: 1, packageC: 0, adjustment: 0 },     // Jul
    8: { packageA: 2, packageB: 0, packageC: 0, adjustment: 0 },     // Aug
    9: { packageA: 1, packageB: 0, packageC: 0, adjustment: 0 },     // Sep
    10: { packageA: 2, packageB: 0, packageC: 0, adjustment: 0 },    // Oct
    11: { packageA: 0, packageB: 2, packageC: 0, adjustment: 0 },    // Nov
    12: { packageA: 2, packageB: 0, packageC: 0, adjustment: 0 },    // Dec
  },
};

const PACKAGE_PRICES = {
  A: 500,
  B: 800,
  C: 1200,
};

// =============================================================================
// ARCHIVE FOLDER SCANNER
// =============================================================================

interface ArchiveEvent {
  folderName: string;
  date: string;       // YYYY-MM-DD
  year: number;
  month: number;
  day: number;
  eventType: string;  // "Wedding", "Corporate", "Collab"
  clientName: string;
}

function scanArchiveFolder(): ArchiveEvent[] {
  const events: ArchiveEvent[] = [];

  if (!fs.existsSync(ARCHIVE_PATH)) {
    console.error(`Archive folder not found: ${ARCHIVE_PATH}`);
    return events;
  }

  const folders = fs.readdirSync(ARCHIVE_PATH, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  // Pattern: YYYYMMDD EventType ClientName
  const pattern = /^(\d{4})(\d{2})(\d{2})\s+(\w+)\s+(.+)$/;

  for (const folder of folders) {
    const match = folder.match(pattern);
    if (match) {
      const [, yearStr, monthStr, dayStr, eventType, clientName] = match;
      events.push({
        folderName: folder,
        date: `${yearStr}-${monthStr}-${dayStr}`,
        year: parseInt(yearStr),
        month: parseInt(monthStr),
        day: parseInt(dayStr),
        eventType,
        clientName: clientName.trim(),
      });
    }
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date));

  return events;
}

// =============================================================================
// INVOICE RECORD GENERATOR
// =============================================================================

interface InvoiceRecord {
  invoiceNumber: string;
  documentType: 'invoice';
  status: 'paid';
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
  items: Array<{
    id: string;
    description: string;
    details: string;
    quantity: number;
    rate: number;
  }>;
  discount: number;
  discountType: 'amount';
  depositPaid: number;
  total: number;
  createdAt: string;
  deletedAt: string;
}

interface AssignmentResult {
  event: ArchiveEvent;
  packageType: 'A' | 'B' | 'C';
  basePrice: number;
  adjustment: number;
  finalAmount: number;
  invoiceNumber: string;
}

function assignPackagesToEvents(events: ArchiveEvent[]): AssignmentResult[] {
  const results: AssignmentResult[] = [];

  // Group events by year-month
  const eventsByYearMonth: { [key: string]: ArchiveEvent[] } = {};
  for (const event of events) {
    const key = `${event.year}-${event.month}`;
    if (!eventsByYearMonth[key]) {
      eventsByYearMonth[key] = [];
    }
    eventsByYearMonth[key].push(event);
  }

  // Invoice number counters per year
  const invoiceCounters: { [year: number]: number } = {};

  // Process each month
  for (const [key, monthEvents] of Object.entries(eventsByYearMonth)) {
    const [yearStr, monthStr] = key.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    // Get historical data for this month
    const yearData = HISTORICAL_DATA[year];
    if (!yearData || !yearData[month]) {
      console.log(`⚠️  No historical data for ${year}-${month.toString().padStart(2, '0')}`);
      continue;
    }

    const monthData = yearData[month];
    let remainingA = monthData.packageA;
    let remainingB = monthData.packageB;
    let remainingC = monthData.packageC;
    const totalAdjustment = monthData.adjustment;

    // Calculate adjustment per event
    const eventCount = monthEvents.length;
    const adjustmentPerEvent = eventCount > 0 ? Math.round(totalAdjustment / eventCount) : 0;

    // Assign packages to events (B first since it's more premium, then A)
    for (const event of monthEvents) {
      // Initialize counter for year
      if (!invoiceCounters[year]) {
        invoiceCounters[year] = 0;
      }
      invoiceCounters[year]++;

      let packageType: 'A' | 'B' | 'C';
      let basePrice: number;

      if (remainingB > 0) {
        packageType = 'B';
        basePrice = PACKAGE_PRICES.B;
        remainingB--;
      } else if (remainingA > 0) {
        packageType = 'A';
        basePrice = PACKAGE_PRICES.A;
        remainingA--;
      } else if (remainingC > 0) {
        packageType = 'C';
        basePrice = PACKAGE_PRICES.C;
        remainingC--;
      } else {
        // Default to Package A if we have more events than recorded
        console.log(`⚠️  More events than recorded for ${year}-${month.toString().padStart(2, '0')}: ${event.clientName}`);
        packageType = 'A';
        basePrice = PACKAGE_PRICES.A;
      }

      const invoiceNumber = `INV-${year}-${invoiceCounters[year].toString().padStart(3, '0')}`;
      const finalAmount = Math.max(0, basePrice + adjustmentPerEvent);

      results.push({
        event,
        packageType,
        basePrice,
        adjustment: adjustmentPerEvent,
        finalAmount,
        invoiceNumber,
      });
    }
  }

  return results;
}

function generateInvoiceRecords(assignments: AssignmentResult[]): InvoiceRecord[] {
  return assignments.map(assignment => {
    const { event, packageType, finalAmount, invoiceNumber } = assignment;

    const packageName = packageType === 'A' ? 'Entrance Performance' :
                       packageType === 'B' ? 'Entrance + Cake Cutting' :
                       'Full Package';

    return {
      invoiceNumber,
      documentType: 'invoice',
      status: 'paid',
      clientName: event.clientName,
      clientPhone: '',
      clientEmail: '',
      clientAddress: '',
      eventType: `${event.eventType} Reception`,
      eventDate: event.date,
      eventTimeHour: '7',
      eventTimeMinute: '00',
      eventTimePeriod: 'PM',
      eventVenue: '',
      items: [
        {
          id: '1',
          description: `Package ${packageType} - ${packageName}`,
          details: 'Historical record - imported from archive',
          quantity: 1,
          rate: finalAmount,
        },
      ],
      discount: 0,
      discountType: 'amount',
      depositPaid: finalAmount, // Fully paid
      total: finalAmount,
      createdAt: new Date(event.date).toISOString(),
      deletedAt: '',
    };
  });
}

// =============================================================================
// OUTPUT FUNCTIONS
// =============================================================================

function generatePreviewCSV(assignments: AssignmentResult[]): string {
  const headers = [
    'Invoice Number',
    'Date',
    'Client Name',
    'Event Type',
    'Package',
    'Base Price',
    'Adjustment',
    'Final Amount',
  ];

  const rows = assignments.map(a => [
    a.invoiceNumber,
    a.event.date,
    a.event.clientName,
    a.event.eventType,
    `Package ${a.packageType}`,
    `RM ${a.basePrice}`,
    a.adjustment !== 0 ? `${a.adjustment > 0 ? '+' : ''}RM ${a.adjustment}` : '-',
    `RM ${a.finalAmount}`,
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csv;
}

async function pushToGoogleSheets(invoices: InvoiceRecord[]): Promise<void> {
  if (!GOOGLE_SCRIPT_URL) {
    console.error('❌ NEXT_PUBLIC_GOOGLE_SCRIPT_URL not set');
    process.exit(1);
  }

  console.log(`\n📤 Pushing ${invoices.length} records to Google Sheets...\n`);

  let successCount = 0;
  let errorCount = 0;

  // Push one at a time to avoid URL length limits
  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];
    const progress = `[${i + 1}/${invoices.length}]`;

    try {
      const params = new URLSearchParams({
        action: 'saveInvoice',
        data: JSON.stringify(invoice),
      });

      const response = await fetch(`${GOOGLE_SCRIPT_URL}?${params}`, {
        method: 'GET',
        redirect: 'follow',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log(`  ${progress} ✓ ${invoice.clientName}`);
          successCount++;
        } else {
          console.error(`  ${progress} ✗ ${invoice.clientName}: ${result.error}`);
          errorCount++;
        }
      } else {
        console.error(`  ${progress} ✗ ${invoice.clientName}: HTTP ${response.status}`);
        errorCount++;
      }
    } catch (error) {
      console.error(`  ${progress} ✗ ${invoice.clientName}: Network error`);
      errorCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ✅ Success: ${successCount}`);
  if (errorCount > 0) {
    console.log(`  ❌ Errors: ${errorCount}`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

function printSummary(assignments: AssignmentResult[]): void {
  // Group by year
  const byYear: { [year: number]: AssignmentResult[] } = {};
  for (const a of assignments) {
    const year = a.event.year;
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(a);
  }

  console.log('\n📊 Summary by Year:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let grandTotalEvents = 0;
  let grandTotalRevenue = 0;

  for (const year of Object.keys(byYear).map(Number).sort()) {
    const yearData = byYear[year];
    const totalEvents = yearData.length;
    const totalRevenue = yearData.reduce((sum, a) => sum + a.finalAmount, 0);
    const packageCounts = {
      A: yearData.filter(a => a.packageType === 'A').length,
      B: yearData.filter(a => a.packageType === 'B').length,
      C: yearData.filter(a => a.packageType === 'C').length,
    };

    console.log(`\n  ${year}:`);
    console.log(`    Events: ${totalEvents}`);
    console.log(`    Revenue: RM ${totalRevenue.toLocaleString()}`);
    console.log(`    Packages: A(${packageCounts.A}) B(${packageCounts.B}) C(${packageCounts.C})`);

    grandTotalEvents += totalEvents;
    grandTotalRevenue += totalRevenue;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n  TOTAL: ${grandTotalEvents} events, RM ${grandTotalRevenue.toLocaleString()}`);
  console.log('');
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldPush = args.includes('--push');

  console.log('\n🎷 WZHarith Studio - Historical Data Import\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Step 1: Scan Archive folder
  console.log('\n📁 Scanning Archive folder...');
  const events = scanArchiveFolder();
  console.log(`   Found ${events.length} event folders`);

  // Filter to only 2024 and 2025 (historical data years)
  const historicalEvents = events.filter(e => e.year === 2024 || e.year === 2025);
  console.log(`   ${historicalEvents.length} events in 2024-2025\n`);

  // Step 2: Assign packages based on monthly data
  console.log('📦 Assigning packages based on historical data...');
  const assignments = assignPackagesToEvents(historicalEvents);
  console.log(`   Matched ${assignments.length} events\n`);

  // Step 3: Print preview
  console.log('📋 Preview of records to import:\n');
  console.log('  Date       | Client Name                 | Package | Amount');
  console.log('  -----------|-----------------------------|---------|---------');

  for (const a of assignments) {
    const clientName = a.event.clientName.substring(0, 25).padEnd(27);
    const pkg = `Pkg ${a.packageType}`.padEnd(7);
    console.log(`  ${a.event.date} | ${clientName} | ${pkg} | RM ${a.finalAmount}`);
  }

  // Step 4: Print summary
  printSummary(assignments);

  // Step 5: Generate CSV
  const csvPath = path.resolve(__dirname, 'historical-preview.csv');
  const csv = generatePreviewCSV(assignments);
  fs.writeFileSync(csvPath, csv);
  console.log(`\n📄 Preview CSV saved to: ${csvPath}`);

  // Step 6: Push to Google Sheets if requested
  if (shouldPush) {
    const invoices = generateInvoiceRecords(assignments);
    await pushToGoogleSheets(invoices);
  } else {
    console.log('\n💡 To push to Google Sheets, run:');
    console.log('   npm run import:push\n');
  }
}

main().catch(console.error);
