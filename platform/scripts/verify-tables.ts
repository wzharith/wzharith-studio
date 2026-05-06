import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, '../.env.local') });

import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const counts = await sql`
    SELECT 'invoices' AS t, COUNT(*) AS c FROM invoices
    UNION ALL SELECT 'config_kv', COUNT(*) FROM config_kv
    UNION ALL SELECT 'config_history', COUNT(*) FROM config_history
    UNION ALL SELECT 'inquiries', COUNT(*) FROM inquiries
    UNION ALL SELECT 'subscribers', COUNT(*) FROM subscribers
    UNION ALL SELECT 'settings', COUNT(*) FROM settings
    ORDER BY t;
  `;
  console.log('Row counts:');
  for (const r of counts as Array<{ t: string; c: string }>) {
    console.log(`  ${r.t.padEnd(16)} ${r.c}`);
  }

  const sample = (await sql`
    SELECT invoice_number, document_type, status, client_name, total
    FROM invoices ORDER BY created_at DESC LIMIT 5;
  `) as Array<{ invoice_number: string; document_type: string; status: string; client_name: string; total: number }>;
  console.log('\nLatest invoices:');
  for (const r of sample) {
    console.log(`  ${r.invoice_number.padEnd(14)} ${r.document_type.padEnd(10)} ${r.status.padEnd(20)} ${r.client_name.padEnd(25)} RM ${r.total}`);
  }
}

main();
