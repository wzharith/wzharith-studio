/**
 * Proxy for saving config to Google Apps Script.
 * Avoids CORS (POST from browser to Apps Script is blocked) and URL length limits (GET with large payload fails).
 * Server-side POST to the script URL has no CORS and can send large JSON in the body.
 */

import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || '';

export async function POST(request: NextRequest) {
  if (!GOOGLE_SCRIPT_URL) {
    return NextResponse.json({ success: false, error: 'Google sync not configured' }, { status: 400 });
  }

  let body: { data?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const data = body?.data;
  if (data === undefined || typeof data !== 'object' || data === null) {
    return NextResponse.json({ success: false, error: 'Missing or invalid body.data' }, { status: 400 });
  }

  const payload = JSON.stringify({ action: 'saveConfig', data });

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      redirect: 'follow',
    });

    const text = await response.text();
    let result: { success?: boolean; error?: string };
    try {
      result = JSON.parse(text);
    } catch {
      result = { success: false, error: `Unexpected response: ${text.slice(0, 200)}` };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/google-sync/save-config]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to reach Google Apps Script' },
      { status: 502 }
    );
  }
}
