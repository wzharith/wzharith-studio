'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, X, Loader2 } from 'lucide-react';

interface AvailabilityCalendarProps {
  onDateSelect?: (date: string) => void;
  selectedDate?: string;
  bookedDates?: string[];
  compact?: boolean;
}

export default function AvailabilityCalendar({
  onDateSelect,
  selectedDate,
  bookedDates = [],
  compact = false,
}: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedDates, setFetchedDates] = useState<string[]>([]);

  // Combine passed bookedDates with fetched dates
  const allBookedDates = [...new Set([...bookedDates, ...fetchedDates])];

  // Fetch availability from Google Apps Script (if configured)
  useEffect(() => {
    const fetchAvailability = async () => {
      const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
      if (!scriptUrl) return;

      setIsLoading(true);
      try {
        // Note: Due to CORS, this may not work directly in browser
        // For production, use a proxy or server-side API
        const month = currentMonth.getMonth() + 1;
        const year = currentMonth.getFullYear();
        
        // For now, we'll use the passed bookedDates prop
        // Real implementation would fetch from Google Apps Script
        setFetchedDates([]);
      } catch (error) {
        console.error('Error fetching availability:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailability();
  }, [currentMonth]);

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday

    return { daysInMonth, startingDay, year, month };
  };

  const { daysInMonth, startingDay, year, month } = getDaysInMonth(currentMonth);

  // Generate calendar days
  const days = [];
  
  // Empty cells for days before the 1st
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isBooked = allBookedDates.includes(dateStr);
    const isSelected = selectedDate === dateStr;
    const isPast = new Date(dateStr) < new Date(new Date().toDateString());
    const isToday = new Date(dateStr).toDateString() === new Date().toDateString();
    
    days.push({
      day,
      dateStr,
      isBooked,
      isSelected,
      isPast,
      isToday,
    });
  }

  // Navigation
  const goToPrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Month/Year display
  const monthYear = currentMonth.toLocaleDateString('en-MY', {
    month: 'long',
    year: 'numeric',
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-xl ${compact ? 'p-4' : 'p-6'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-2 hover:bg-gold-500/10 rounded-lg text-gold-400 transition-colors"
          disabled={new Date(year, month, 1) <= new Date()}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <h3 className={`font-display font-semibold text-white ${compact ? 'text-lg' : 'text-xl'}`}>
            {monthYear}
          </h3>
          {isLoading && <Loader2 className="w-4 h-4 text-gold-400 animate-spin" />}
        </div>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gold-500/10 rounded-lg text-gold-400 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((name) => (
          <div
            key={name}
            className={`text-center font-sans text-midnight-400 ${compact ? 'text-xs py-1' : 'text-sm py-2'}`}
          >
            {compact ? name[0] : name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const { day: dayNum, dateStr, isBooked, isSelected, isPast, isToday } = day;

          return (
            <button
              key={dateStr}
              onClick={() => !isBooked && !isPast && onDateSelect?.(dateStr)}
              disabled={isBooked || isPast}
              className={`
                aspect-square rounded-lg flex items-center justify-center font-sans transition-all
                ${compact ? 'text-xs' : 'text-sm'}
                ${isPast ? 'text-midnight-600 cursor-not-allowed' : ''}
                ${isToday ? 'ring-2 ring-gold-400' : ''}
                ${isSelected ? 'bg-gold-500 text-midnight-950 font-bold' : ''}
                ${isBooked ? 'bg-red-500/20 text-red-400 cursor-not-allowed' : ''}
                ${!isBooked && !isPast && !isSelected ? 'hover:bg-gold-500/20 text-white cursor-pointer' : ''}
              `}
              title={isBooked ? 'Booked' : isPast ? 'Past date' : `Select ${dateStr}`}
            >
              {isBooked ? (
                <X className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
              ) : isSelected ? (
                <Check className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
              ) : (
                dayNum
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className={`flex justify-center gap-4 mt-4 ${compact ? 'text-xs' : 'text-sm'}`}>
        <div className="flex items-center gap-1 text-midnight-400">
          <div className="w-3 h-3 rounded bg-gold-500/20" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1 text-red-400">
          <div className="w-3 h-3 rounded bg-red-500/20" />
          <span>Booked</span>
        </div>
        {selectedDate && (
          <div className="flex items-center gap-1 text-gold-400">
            <div className="w-3 h-3 rounded bg-gold-500" />
            <span>Selected</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
