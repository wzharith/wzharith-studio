# Google Apps Script Setup Guide

This guide will help you set up the Google Apps Script backend for WZHarith Studio.

## What This Script Does

- **📊 Google Sheets**: Stores all invoices and quotations as a backup
- **📅 Google Calendar**: Creates events for each booking
- **⏰ Reminders**: Automatically creates:
  - Song confirmation reminder (14 days before)
  - Balance payment reminder (3 days before)
- **📆 Availability**: Provides booked dates for the availability calendar

## Setup Steps

### 1. Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it: `WZHarith Studio - Bookings`
4. Copy the **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
   ```

### 2. Create Google Apps Script Project

1. Go to [Google Apps Script](https://script.google.com)
2. Click **New Project**
3. Delete the default `myFunction` code
4. Copy the entire contents of `Code.gs` and paste it

### 3. Update Configuration

At the top of the script, update these values:

```javascript
const SHEET_ID = 'YOUR_SHEET_ID_HERE';
const CALENDAR_ID = 'your.email@gmail.com'; // Usually your email
```

### 4. Test the Setup

1. In the script editor, select `testSetup` from the function dropdown
2. Click **Run**
3. Check the Logs (View > Logs) for results
4. You should see:
   ```
   ✅ Sheet access OK: WZHarith Studio - Bookings
   ✅ Calendar access OK: your.email@gmail.com
   ```

### 5. Deploy as Web App

1. Click **Deploy** > **New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Configure:
   - **Description**: `WZHarith Studio API v1`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. Authorize the app when prompted
6. Copy the **Web app URL**

### 6. Configure Your Website

Add the Web App URL to your environment:

**For local development** (`.env.local`):
```env
NEXT_PUBLIC_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

**For GitHub Pages** (Settings > Secrets):
Add a new secret:
- Name: `GOOGLE_SCRIPT_URL`
- Value: Your Web App URL

## API Reference

### GET Endpoints

#### Get Availability
```
GET ?action=getAvailability&month=1&year=2026
```
Returns booked dates for a specific month.

#### Get All Events
```
GET ?action=getEvents
```
Returns all upcoming events.

#### Get All Invoices
```
GET ?action=getInvoices
```
Returns all invoices from the sheet.

### POST Endpoints

#### Save Invoice
```json
POST
{
  "action": "saveInvoice",
  "invoice": {
    "invoiceNumber": "QUO-2026-001",
    "documentType": "quotation",
    "clientName": "Client Name",
    ...
  }
}
```

#### Create Calendar Event
```json
POST
{
  "action": "createEvent",
  "event": {
    "clientName": "Client Name",
    "eventDate": "2026-02-14",
    "eventTime": "7:00 PM",
    "venue": "Venue Name",
    ...
  }
}
```

#### Sync All Invoices
```json
POST
{
  "action": "syncAll",
  "invoices": [...]
}
```

## Sheet Structure

The script automatically creates these sheets:

### Invoices Sheet
| Column | Description |
|--------|-------------|
| Invoice Number | QUO-2026-001, INV-2026-001 |
| Document Type | quotation, invoice |
| Status | draft, sent, paid, cancelled |
| Client Name | Full name |
| Client Phone | Phone number |
| Client Email | Email address |
| Event Date | YYYY-MM-DD |
| Event Time | 7:00 PM |
| Venue | Venue name |
| Total | Total amount |
| Deposit Paid | Deposit amount |
| Items JSON | Line items as JSON |

## Troubleshooting

### "Sheet not found" error
- Make sure SHEET_ID is correct
- Ensure you have edit access to the sheet

### "Calendar not found" error
- Try using your email address as CALENDAR_ID
- Make sure the calendar exists and you have access

### "Authorization required" error
- Run `testSetup` first to trigger authorization
- Accept all permission prompts

### CORS errors in browser
- This is expected - the script must be called via a proxy
- The website handles this automatically

## Updating the Script

If you need to update the script:

1. Make your changes in the script editor
2. Deploy > Manage deployments
3. Edit the existing deployment (don't create new)
4. Update version number
5. Click **Deploy**

The URL stays the same after updates.

## Security Notes

- The script runs with your Google account permissions
- Only people with the URL can access the API
- Consider adding API key validation for production
- Invoice data is stored in your personal Google Drive
