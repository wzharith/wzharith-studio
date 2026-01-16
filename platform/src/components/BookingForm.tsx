'use client';

import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Calendar, Clock, MapPin, Music, CheckCircle, MessageCircle, CalendarCheck } from 'lucide-react';
import { siteConfig, getWhatsAppUrl, getSocialUrl } from '@/config/site.config';
import AvailabilityCalendar from './AvailabilityCalendar';
import { saveBookingInquiry, isGoogleSyncEnabled } from '@/lib/google-sync';

interface BookingFormData {
  name: string;
  email: string;
  phone: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  packageId: string;
  songRequests: string;
  message: string;
}

export default function BookingForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  // Example booked dates - in production, this would come from Google Calendar
  const bookedDates: string[] = [
    // Add booked dates here when connected to Google Calendar
  ];

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<BookingFormData>();

  const selectedPackage = watch('packageId');

  const onSubmit = async (data: BookingFormData) => {
    const pkg = siteConfig.packages.find((p) => p.id === data.packageId);
    const eventDateToUse = data.eventDate || selectedDate;

    // Format WhatsApp message
    const message = `
*New Booking Inquiry*

*Name:* ${data.name}
*Email:* ${data.email}
*Phone:* ${data.phone}

*Event Details:*
📅 Date: ${eventDateToUse}
⏰ Time: ${data.eventTime}
📍 Venue: ${data.venue}

*Package:* ${pkg?.name || 'Not specified'}
*Song Requests:* ${data.songRequests || 'None'}

*Additional Message:*
${data.message || 'None'}
    `.trim();

    // Open WhatsApp FIRST - don't wait for save
    window.open(getWhatsAppUrl(message), '_blank');
    setIsSubmitted(true);

    // Save inquiry to Google Sheets + create draft quotation in background (if configured)
    if (isGoogleSyncEnabled()) {
      // Don't await - let it happen in background
      saveBookingInquiry({
        name: data.name,
        email: data.email,
        phone: data.phone,
        eventDate: eventDateToUse,
        eventTime: data.eventTime,
        venue: data.venue,
        packageId: data.packageId,
        packageName: pkg?.name,
        packagePrice: pkg?.price,
        songRequests: data.songRequests,
        message: data.message,
      }).then(() => {
        console.log('Inquiry saved to Google Sheets');
      }).catch((error) => {
        console.error('Failed to save inquiry:', error);
      });
    }
  };

  return (
    <section id="booking" className="py-24 px-6 relative" ref={ref}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold-500/5 to-transparent pointer-events-none" />

      <div className="max-w-4xl mx-auto relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-12"
        >
          <span className="font-sans text-gold-400 text-sm tracking-widest uppercase">
            Book Now
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-4 mb-6">
            Reserve Your <span className="gold-text">Date</span>
          </h2>
          <p className="font-body text-lg text-midnight-300 max-w-2xl mx-auto">
            Fill out the form below and I&apos;ll get back to you within 24 hours to
            confirm your booking and discuss the details.
          </p>
        </motion.div>

        {isSubmitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-12 text-center"
          >
            <CheckCircle className="w-16 h-16 text-gold-400 mx-auto mb-6" />
            <h3 className="font-display text-2xl font-bold text-white mb-4">
              Inquiry Sent!
            </h3>
            <p className="font-body text-midnight-300 mb-8">
              Thank you for your interest! I&apos;ll respond to your inquiry via
              WhatsApp within 24 hours.
            </p>
            <button
              onClick={() => setIsSubmitted(false)}
              className="px-6 py-3 glass rounded-full text-gold-400 font-sans font-medium hover:bg-gold-500/10 transition-all"
            >
              Submit Another Inquiry
            </button>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            onSubmit={handleSubmit(onSubmit)}
            className="glass rounded-2xl p-8"
          >
            <div className="grid md:grid-cols-2 gap-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <h4 className="font-sans font-semibold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gold-500 text-midnight-950 flex items-center justify-center text-xs">
                    1
                  </span>
                  Your Details
                </h4>

                <div>
                  <label className="block text-sm text-midnight-400 mb-1">
                    Full Name *
                  </label>
                  <input
                    {...register('name', { required: 'Name is required' })}
                    className="w-full px-4 py-3 rounded-lg bg-midnight-800/50 border border-midnight-700 text-white focus:outline-none focus:border-gold-500 transition-colors"
                    placeholder="Your name"
                  />
                  {errors.name && (
                    <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-midnight-400 mb-1">
                    Email *
                  </label>
                  <input
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                    type="email"
                    className="w-full px-4 py-3 rounded-lg bg-midnight-800/50 border border-midnight-700 text-white focus:outline-none focus:border-gold-500 transition-colors"
                    placeholder="your@email.com"
                  />
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-midnight-400 mb-1">
                    Phone/WhatsApp *
                  </label>
                  <input
                    {...register('phone', { required: 'Phone is required' })}
                    type="tel"
                    className="w-full px-4 py-3 rounded-lg bg-midnight-800/50 border border-midnight-700 text-white focus:outline-none focus:border-gold-500 transition-colors"
                    placeholder="+60 12-345 6789"
                  />
                  {errors.phone && (
                    <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              {/* Event Info */}
              <div className="space-y-4">
                <h4 className="font-sans font-semibold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gold-500 text-midnight-950 flex items-center justify-center text-xs">
                    2
                  </span>
                  Event Details
                </h4>

                {/* Check Availability Button */}
                {siteConfig.features.showAvailabilityCalendar && (
                  <button
                    type="button"
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 glass rounded-lg text-gold-400 hover:bg-gold-500/10 transition-all"
                  >
                    <CalendarCheck className="w-4 h-4" />
                    {showCalendar ? 'Hide Availability' : 'Check Availability'}
                  </button>
                )}

                {/* Availability Calendar */}
                {showCalendar && siteConfig.features.showAvailabilityCalendar && (
                  <div className="mb-4">
                    <AvailabilityCalendar
                      compact
                      bookedDates={bookedDates}
                      selectedDate={selectedDate}
                      onDateSelect={(date) => {
                        setSelectedDate(date);
                        // Also update the form field if using react-hook-form
                      }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-midnight-400 mb-1">
                      <Calendar className="inline w-3 h-3 mr-1" />
                      Event Date *
                    </label>
                    <input
                      {...register('eventDate', { required: 'Date is required' })}
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-midnight-800/50 border border-midnight-700 text-white focus:outline-none focus:border-gold-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-midnight-400 mb-1">
                      <Clock className="inline w-3 h-3 mr-1" />
                      Event Time *
                    </label>
                    <input
                      {...register('eventTime', { required: 'Time is required' })}
                      type="time"
                      className="w-full px-4 py-3 rounded-lg bg-midnight-800/50 border border-midnight-700 text-white focus:outline-none focus:border-gold-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-midnight-400 mb-1">
                    <MapPin className="inline w-3 h-3 mr-1" />
                    Venue *
                  </label>
                  <input
                    {...register('venue', { required: 'Venue is required' })}
                    className="w-full px-4 py-3 rounded-lg bg-midnight-800/50 border border-midnight-700 text-white focus:outline-none focus:border-gold-500 transition-colors"
                    placeholder="Venue name and location"
                  />
                </div>

                <div>
                  <label className="block text-sm text-midnight-400 mb-1">
                    <Music className="inline w-3 h-3 mr-1" />
                    Package
                  </label>
                  <select
                    {...register('packageId')}
                    className="w-full px-4 py-3 rounded-lg bg-midnight-800/50 border border-midnight-700 text-white focus:outline-none focus:border-gold-500 transition-colors"
                  >
                    <option value="">Select a package</option>
                    {siteConfig.packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} - {pkg.priceDisplay}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-6 space-y-4">
              <h4 className="font-sans font-semibold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gold-500 text-midnight-950 flex items-center justify-center text-xs">
                  3
                </span>
                Additional Information
              </h4>

              <div>
                <label className="block text-sm text-midnight-400 mb-1">
                  Song Requests (optional)
                </label>
                <input
                  {...register('songRequests')}
                  className="w-full px-4 py-3 rounded-lg bg-midnight-800/50 border border-midnight-700 text-white focus:outline-none focus:border-gold-500 transition-colors"
                  placeholder="e.g., Can't Help Falling in Love, Perfect"
                />
              </div>

              <div>
                <label className="block text-sm text-midnight-400 mb-1">
                  Message (optional)
                </label>
                <textarea
                  {...register('message')}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-midnight-800/50 border border-midnight-700 text-white focus:outline-none focus:border-gold-500 transition-colors resize-none"
                  placeholder="Any special requests or questions?"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-midnight-500">
                By submitting, you agree to be contacted via WhatsApp regarding your booking.
              </p>
              <button
                type="submit"
                className="px-8 py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-midnight-950 font-sans font-semibold rounded-full hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg hover:shadow-gold-500/25 flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Send via WhatsApp
              </button>
            </div>
          </motion.form>
        )}

        {/* Alternative Contact */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="font-sans text-sm text-midnight-400 mb-4">
            Prefer to reach out directly?
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-gold-400 text-sm hover:bg-gold-500/10 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
            {siteConfig.social.instagram && (
              <a
                href={getSocialUrl('instagram')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-gold-400 text-sm hover:bg-gold-500/10 transition-all"
              >
                IG: @{siteConfig.social.instagram}
              </a>
            )}
            {siteConfig.social.tiktok && (
              <a
                href={getSocialUrl('tiktok')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-gold-400 text-sm hover:bg-gold-500/10 transition-all"
              >
                TikTok: @{siteConfig.social.tiktok}
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
