/**
 * WhatsApp Message Templates
 *
 * Pre-formatted messages for common business communications
 */

import { siteConfig, getPhoneDisplay } from '@/config/site.config';

// Emoji constants using Unicode escapes for reliable encoding in wa.me URLs
const EMOJI = {
  saxophone: '\u{1F3B7}',     // 🎷
  clipboard: '\u{1F4CB}',     // 📋
  calendar: '\u{1F4C5}',      // 📅
  clock: '\u{23F0}',          // ⏰
  pin: '\u{1F4CD}',           // 📍
  music: '\u{1F3B5}',         // 🎵
  money: '\u{1F4B0}',         // 💰
  dollar: '\u{1F4B5}',        // 💵
  bank: '\u{1F3E6}',          // 🏦
  person: '\u{1F464}',        // 👤
  numbers: '\u{1F522}',       // 🔢
  sparkles: '\u{2728}',       // ✨
  check: '\u{2705}',          // ✅
  hourglass: '\u{23F3}',      // ⏳
  calendarPage: '\u{1F4C6}',  // 📆
  party: '\u{1F389}',         // 🎉
  pencil: '\u{270F}\u{FE0F}', // ✏️
  arrows: '\u{1F504}',        // 🔄
  star: '\u{2B50}',           // ⭐
  camera: '\u{1F4F8}',        // 📸
  link: '\u{1F517}',          // 🔗
  pray: '\u{1F64F}',          // 🙏
  phone: '\u{1F4F1}',         // 📱
} as const;

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
  return `Assalamualaikum / Hi ${data.clientName}! ${EMOJI.saxophone}

Thank you for your interest in ${siteConfig.business.name}!

Here's the quotation for your special day:

${EMOJI.clipboard} *Quotation ${data.invoiceNumber}*
${EMOJI.calendar} Date: ${data.eventDate}
${EMOJI.clock} Time: ${data.eventTime}
${EMOJI.pin} Venue: ${data.venue}

${EMOJI.music} *Package: ${data.packageName}*
${EMOJI.money} Total: RM ${data.total.toFixed(2)}
${EMOJI.dollar} Deposit (${siteConfig.terms.depositPercent}%): RM ${data.deposit.toFixed(2)}

To confirm your booking, please transfer the deposit to:
${EMOJI.bank} ${siteConfig.banking.bank}
${EMOJI.person} ${siteConfig.banking.accountName}
${EMOJI.numbers} ${siteConfig.banking.accountNumber}

${siteConfig.terms.cancellationPolicy}. Balance is due ${siteConfig.terms.balanceDueDays} days before the event.

Looking forward to creating magical moments at your event! ${EMOJI.sparkles}

Best regards,
${siteConfig.business.name}
${EMOJI.phone} ${getPhoneDisplay()}`.trim();
};

/**
 * Generate booking confirmation message
 */
export const generateConfirmationMessage = (data: ConfirmationData): string => {
  return `Assalamualaikum / Hi ${data.clientName}! ${EMOJI.saxophone}

Your booking has been *CONFIRMED*! ${EMOJI.check}

${EMOJI.clipboard} *Booking Details*
${EMOJI.calendar} Date: ${data.eventDate}
${EMOJI.clock} Time: ${data.eventTime}
${EMOJI.pin} Venue: ${data.venue}

${EMOJI.money} *Payment Summary*
${EMOJI.check} Deposit Paid: RM ${data.depositAmount.toFixed(2)}
${EMOJI.hourglass} Balance Due: RM ${data.balanceAmount.toFixed(2)}

Balance is due ${siteConfig.terms.balanceDueDays} days before the event.

I'll reach out 2 weeks before to confirm the song list.

Feel free to contact me if you have any questions!

Best regards,
${siteConfig.business.name}
${EMOJI.phone} ${getPhoneDisplay()}`.trim();
};

/**
 * Generate balance reminder message
 */
export const generateBalanceReminderMessage = (data: ReminderData): string => {
  return `Assalamualaikum / Hi ${data.clientName}! ${EMOJI.saxophone}

This is a friendly reminder about your upcoming event:

${EMOJI.calendar} Date: ${data.eventDate}
${EMOJI.clock} Time: ${data.eventTime}
${EMOJI.pin} Venue: ${data.venue}

${EMOJI.money} *Balance Due: RM ${data.balanceAmount.toFixed(2)}*
${EMOJI.calendarPage} Due by: ${data.dueDate}

Please transfer to:
${EMOJI.bank} ${siteConfig.banking.bank}
${EMOJI.person} ${siteConfig.banking.accountName}
${EMOJI.numbers} ${siteConfig.banking.accountNumber}

Thank you! Looking forward to your event! ${EMOJI.sparkles}

${siteConfig.business.name}`.trim();
};

/**
 * Generate song confirmation message
 */
export const generateSongConfirmationMessage = (data: SongConfirmationData): string => {
  const songsList = data.currentSongs.length > 0
    ? data.currentSongs.map((song, i) => `${i + 1}. ${song}`).join('\n')
    : 'Not yet confirmed';

  return `Assalamualaikum / Hi ${data.clientName}! ${EMOJI.saxophone}

Your event is in 2 weeks! ${EMOJI.party}

${EMOJI.calendar} Date: ${data.eventDate}

Let's confirm your song list:

${EMOJI.music} *Current Songs:*
${songsList}

Would you like to:
${EMOJI.pencil} Add any songs?
${EMOJI.arrows} Change any songs?
${EMOJI.check} Confirm as is?

Please let me know if you have any song requests or changes!

${siteConfig.business.name}`.trim();
};

/**
 * Generate thank you message (post-event)
 */
export const generateThankYouMessage = (data: ThankYouData): string => {
  return `Assalamualaikum / Hi ${data.clientName}! ${EMOJI.saxophone}

Thank you so much for having me at your ${data.eventType}! ${EMOJI.party}

It was truly an honor to be part of your special day on ${data.eventDate}. I hope the music added some magic to your celebration! ${EMOJI.sparkles}

If you enjoyed the performance, I'd really appreciate:
${EMOJI.star} A review/testimony
${EMOJI.camera} Any photos/videos you'd like to share${siteConfig.social.instagram ? `
${EMOJI.link} Tagging @${siteConfig.social.instagram} on social media` : ''}

For future events or referrals, feel free to reach out anytime!

Wishing you all the best,
${siteConfig.business.name}
${EMOJI.phone} ${getPhoneDisplay()}`.trim();
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
 * Get template types for dropdown
 */
export const messageTemplates = [
  { id: 'quotation', name: `${EMOJI.clipboard} Send Quotation`, description: 'Send quotation details to client' },
  { id: 'confirmation', name: `${EMOJI.check} Booking Confirmed`, description: 'Confirm booking after deposit received' },
  { id: 'balance', name: `${EMOJI.money} Balance Reminder`, description: 'Remind about balance payment' },
  { id: 'songs', name: `${EMOJI.music} Song Confirmation`, description: 'Confirm song list (2 weeks before)' },
  { id: 'thankyou', name: `${EMOJI.pray} Thank You`, description: 'Post-event thank you message' },
] as const;

export type MessageTemplateId = typeof messageTemplates[number]['id'];
