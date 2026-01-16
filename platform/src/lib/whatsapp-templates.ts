/**
 * WhatsApp Message Templates
 *
 * Pre-formatted messages for common business communications
 */

import { siteConfig, getWhatsAppUrl, getPhoneDisplay } from '@/config/site.config';

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
  return `Assalamualaikum / Hi ${data.clientName}! 🎷

Thank you for your interest in ${siteConfig.business.name}!

Here's the quotation for your special day:

📋 *Quotation ${data.invoiceNumber}*
📅 Date: ${data.eventDate}
⏰ Time: ${data.eventTime}
📍 Venue: ${data.venue}

🎵 *Package: ${data.packageName}*
💰 Total: RM ${data.total.toFixed(2)}
💵 Deposit (${siteConfig.terms.depositPercent}%): RM ${data.deposit.toFixed(2)}

To confirm your booking, please transfer the deposit to:
🏦 ${siteConfig.banking.bank}
👤 ${siteConfig.banking.accountName}
🔢 ${siteConfig.banking.accountNumber}

${siteConfig.terms.cancellationPolicy}. Balance is due ${siteConfig.terms.balanceDueDays} days before the event.

Looking forward to creating magical moments at your event! ✨

Best regards,
${siteConfig.business.name}
📱 ${getPhoneDisplay()}`.trim();
};

/**
 * Generate booking confirmation message
 */
export const generateConfirmationMessage = (data: ConfirmationData): string => {
  return `Assalamualaikum / Hi ${data.clientName}! 🎷

Your booking has been *CONFIRMED*! ✅

📋 *Booking Details*
📅 Date: ${data.eventDate}
⏰ Time: ${data.eventTime}
📍 Venue: ${data.venue}

💰 *Payment Summary*
✅ Deposit Paid: RM ${data.depositAmount.toFixed(2)}
⏳ Balance Due: RM ${data.balanceAmount.toFixed(2)}

Balance is due ${siteConfig.terms.balanceDueDays} days before the event.

I'll reach out 2 weeks before to confirm the song list.

Feel free to contact me if you have any questions!

Best regards,
${siteConfig.business.name}
📱 ${getPhoneDisplay()}`.trim();
};

/**
 * Generate balance reminder message
 */
export const generateBalanceReminderMessage = (data: ReminderData): string => {
  return `Assalamualaikum / Hi ${data.clientName}! 🎷

This is a friendly reminder about your upcoming event:

📅 Date: ${data.eventDate}
⏰ Time: ${data.eventTime}
📍 Venue: ${data.venue}

💰 *Balance Due: RM ${data.balanceAmount.toFixed(2)}*
📆 Due by: ${data.dueDate}

Please transfer to:
🏦 ${siteConfig.banking.bank}
👤 ${siteConfig.banking.accountName}
🔢 ${siteConfig.banking.accountNumber}

Thank you! Looking forward to your event! ✨

${siteConfig.business.name}`.trim();
};

/**
 * Generate song confirmation message
 */
export const generateSongConfirmationMessage = (data: SongConfirmationData): string => {
  const songsList = data.currentSongs.length > 0
    ? data.currentSongs.map((song, i) => `${i + 1}. ${song}`).join('\n')
    : 'Not yet confirmed';

  return `Assalamualaikum / Hi ${data.clientName}! 🎷

Your event is in 2 weeks! 🎉

📅 Date: ${data.eventDate}

Let's confirm your song list:

🎵 *Current Songs:*
${songsList}

Would you like to:
✏️ Add any songs?
🔄 Change any songs?
✅ Confirm as is?

Please let me know if you have any song requests or changes!

${siteConfig.business.name}`.trim();
};

/**
 * Generate thank you message (post-event)
 */
export const generateThankYouMessage = (data: ThankYouData): string => {
  return `Assalamualaikum / Hi ${data.clientName}! 🎷

Thank you so much for having me at your ${data.eventType}! 🎉

It was truly an honor to be part of your special day on ${data.eventDate}. I hope the music added some magic to your celebration! ✨

If you enjoyed the performance, I'd really appreciate:
⭐ A review/testimony
📸 Any photos/videos you'd like to share${siteConfig.social.instagram ? `
🔗 Tagging @${siteConfig.social.instagram} on social media` : ''}

For future events or referrals, feel free to reach out anytime!

Wishing you all the best,
${siteConfig.business.name}
📱 ${getPhoneDisplay()}`.trim();
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
  { id: 'quotation', name: '📋 Send Quotation', description: 'Send quotation details to client' },
  { id: 'confirmation', name: '✅ Booking Confirmed', description: 'Confirm booking after deposit received' },
  { id: 'balance', name: '💰 Balance Reminder', description: 'Remind about balance payment' },
  { id: 'songs', name: '🎵 Song Confirmation', description: 'Confirm song list (2 weeks before)' },
  { id: 'thankyou', name: '🙏 Thank You', description: 'Post-event thank you message' },
] as const;

export type MessageTemplateId = typeof messageTemplates[number]['id'];
