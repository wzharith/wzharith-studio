/**
 * WhatsApp Message Templates
 *
 * Pre-formatted messages for common business communications
 * Note: Emojis removed from MESSAGE BODY for wa.me URL compatibility
 * Emojis in dropdown labels are fine (UI only)
 */

import { siteConfig, getPhoneDisplay } from '@/config/site.config';

// Website URLs for linking in messages
const WEBSITE_BASE = 'https://wzharith.github.io/wzharith-studio';
const WEBSITE_SONGS = `${WEBSITE_BASE}/#songs`;
const WEBSITE_PACKAGES = `${WEBSITE_BASE}/#packages`;
const WEBSITE_PORTFOLIO = `${WEBSITE_BASE}/#portfolio`;
const WEBSITE_BOOK = `${WEBSITE_BASE}/#booking`;

export interface QuotationData {
  clientName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  packageName: string;
  total: number;
  deposit: number;
  invoiceNumber: string;
}

export interface ConfirmationData {
  clientName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  depositAmount: number;
  balanceAmount: number;
}

export interface ReminderData {
  clientName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  balanceAmount: number;
  dueDate: string;
}

export interface SongConfirmationData {
  clientName: string;
  eventDate: string;
  currentSongs: string[];
}

export interface ThankYouData {
  clientName: string;
  eventType: string;
  eventDate: string;
}

/**
 * Generate quotation follow-up message
 */
export const generateQuotationMessage = (data: QuotationData): string => {
  return `Assalamualaikum / Hi ${data.clientName}!

Thank you for your interest in ${siteConfig.business.name}!

Here's the quotation for your special day:

*Quotation ${data.invoiceNumber}*
- Date: ${data.eventDate}
- Time: ${data.eventTime}
- Venue: ${data.venue}

*Package: ${data.packageName}*
- Total: RM ${data.total.toFixed(2)}
- Deposit (${siteConfig.terms.depositPercent}%): RM ${data.deposit.toFixed(2)}

To confirm your booking, please transfer the deposit to:
*${siteConfig.banking.bank}*
Account: ${siteConfig.banking.accountName}
Number: ${siteConfig.banking.accountNumber}

${siteConfig.terms.cancellationPolicy}. Balance is due ${siteConfig.terms.balanceDueDays} days before the event.

View all packages: ${WEBSITE_PACKAGES}

Looking forward to creating magical moments at your event!

Best regards,
${siteConfig.business.name}
${getPhoneDisplay()}`.trim();
};

/**
 * Generate booking confirmation message
 */
export const generateConfirmationMessage = (data: ConfirmationData): string => {
  return `Assalamualaikum / Hi ${data.clientName}!

Your booking has been *CONFIRMED*!

*Booking Details*
- Date: ${data.eventDate}
- Time: ${data.eventTime}
- Venue: ${data.venue}

*Payment Summary*
- Deposit Paid: RM ${data.depositAmount.toFixed(2)}
- Balance Due: RM ${data.balanceAmount.toFixed(2)}

Balance is due ${siteConfig.terms.balanceDueDays} days before the event.

I'll reach out 2 weeks before to confirm the song list. In the meantime, you can browse the song catalog here:
${WEBSITE_SONGS}

Feel free to contact me if you have any questions!

Best regards,
${siteConfig.business.name}
${getPhoneDisplay()}`.trim();
};

/**
 * Generate balance reminder message
 */
export const generateBalanceReminderMessage = (data: ReminderData): string => {
  return `Assalamualaikum / Hi ${data.clientName}!

This is a friendly reminder about your upcoming event:

- Date: ${data.eventDate}
- Time: ${data.eventTime}
- Venue: ${data.venue}

*Balance Due: RM ${data.balanceAmount.toFixed(2)}*
Due by: ${data.dueDate}

Please transfer to:
*${siteConfig.banking.bank}*
Account: ${siteConfig.banking.accountName}
Number: ${siteConfig.banking.accountNumber}

Thank you! Looking forward to your event!

${siteConfig.business.name}`.trim();
};

/**
 * Generate song confirmation message
 */
export const generateSongConfirmationMessage = (data: SongConfirmationData): string => {
  const songsList = data.currentSongs.length > 0
    ? data.currentSongs.map((song, i) => `${i + 1}. ${song}`).join('\n')
    : 'Not yet confirmed';

  return `Assalamualaikum / Hi ${data.clientName}!

Your event is in 2 weeks!

Date: ${data.eventDate}

Let's confirm your song list:

*Current Songs:*
${songsList}

Would you like to:
- Add any songs?
- Change any songs?
- Confirm as is?

Browse my full song catalog here:
${WEBSITE_SONGS}

Custom song requests are available at RM 100/song (please request at least 2 weeks in advance).

Please let me know your final song selection!

${siteConfig.business.name}`.trim();
};

/**
 * Generate thank you message (post-event)
 */
export const generateThankYouMessage = (data: ThankYouData): string => {
  return `Assalamualaikum / Hi ${data.clientName}!

Thank you so much for having me at your ${data.eventType}!

It was truly an honor to be part of your special day on ${data.eventDate}. I hope the music added some magic to your celebration!

If you enjoyed the performance, I'd really appreciate:
- A review/testimony
- Any photos/videos you'd like to share${siteConfig.social.instagram ? `
- Tagging @${siteConfig.social.instagram} on social media` : ''}

For future events or referrals:
${WEBSITE_BOOK}

Wishing you all the best,
${siteConfig.business.name}
${getPhoneDisplay()}`.trim();
};

/**
 * Open WhatsApp with pre-filled message
 */
export const openWhatsAppWithMessage = (phoneNumber: string, message: string): void => {
  // Clean phone number (remove spaces, dashes)
  const cleanPhone = phoneNumber.replace(/[\s-]/g, '').replace(/^\+/, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

/**
 * Get template types for dropdown (emojis OK here - UI only, not sent via URL)
 */
export const messageTemplates = [
  { id: 'quotation', name: '📋 Send Quotation', description: 'Send quotation details to client' },
  { id: 'confirmation', name: '✅ Booking Confirmed', description: 'Confirm booking after deposit received' },
  { id: 'balance', name: '💰 Balance Reminder', description: 'Remind about balance payment' },
  { id: 'songs', name: '🎵 Song Confirmation', description: 'Confirm song list (2 weeks before)' },
  { id: 'thankyou', name: '🙏 Thank You', description: 'Post-event thank you message' },
] as const;

export type MessageTemplateId = typeof messageTemplates[number]['id'];
