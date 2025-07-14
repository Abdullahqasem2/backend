/**
 * Generate available time slots for a barber on a specific date
 * @param {string} openTime - Barber's opening time (HH:MM format)
 * @param {string} closeTime - Barber's closing time (HH:MM format)
 * @param {number} haircutDuration - Duration of each haircut in minutes
 * @param {Array} existingReservations - Array of existing reservations for the date
 * @param {Array} unavailableSlots - Array of unavailable time slots for the date
 * @returns {Array} Array of available time slots
 */
export function generateTimeSlots(openTime, closeTime, haircutDuration, existingReservations = [], unavailableSlots = []) {
  const slots = [];
  
  // Convert times to minutes for easier calculation
  const openMinutes = timeToMinutes(openTime);
  const closeMinutes = timeToMinutes(closeTime);
  
  // Generate slots every haircutDuration minutes
  for (let time = openMinutes; time < closeMinutes; time += haircutDuration) {
    const timeString = minutesToTime(time);
    
    // Check if this slot is already reserved
    const isReserved = existingReservations.some(reservation => 
      reservation.time === timeString
    );
    
    // Check if this slot is marked as unavailable
    const isUnavailable = unavailableSlots.some(slot => 
      slot.time === timeString && slot.isUnavailable
    );
    
    // Only include slots that are not reserved and not unavailable
    if (!isReserved && !isUnavailable) {
      slots.push({
        time: timeString,
        reserved: false,
        formatted: formatTimeForDisplay(timeString)
      });
    }
  }
  
  return slots;
}

/**
 * Generate ALL time slots for a barber on a specific date (for barber dashboard)
 * @param {string} openTime - Barber's opening time (HH:MM format)
 * @param {string} closeTime - Barber's closing time (HH:MM format)
 * @param {number} haircutDuration - Duration of each haircut in minutes
 * @param {Array} existingReservations - Array of existing reservations for the date
 * @param {Array} unavailableSlots - Array of unavailable time slots for the date
 * @returns {Array} Array of all time slots with status
 */
export function generateAllTimeSlots(openTime, closeTime, haircutDuration, existingReservations = [], unavailableSlots = []) {
  const slots = [];
  
  // Convert times to minutes for easier calculation
  const openMinutes = timeToMinutes(openTime);
  const closeMinutes = timeToMinutes(closeTime);
  
  // Generate slots every haircutDuration minutes
  for (let time = openMinutes; time < closeMinutes; time += haircutDuration) {
    const timeString = minutesToTime(time);
    
    // Check if this slot is already reserved
    const isReserved = existingReservations.some(reservation => 
      reservation.time === timeString
    );
    
    // Check if this slot is marked as unavailable
    const isUnavailable = unavailableSlots.some(slot => 
      slot.time === timeString && slot.isUnavailable
    );
    
    slots.push({
      time: timeString,
      reserved: isReserved,
      unavailable: isUnavailable,
      formatted: formatTimeForDisplay(timeString)
    });
  }
  
  return slots;
}

/**
 * Convert time string (HH:MM) to minutes
 * @param {string} time - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to time string (HH:MM)
 * @param {number} minutes - Minutes since midnight
 * @returns {string} Time in HH:MM format
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Format time for display (e.g., "9:00 AM")
 * @param {string} time - Time in HH:MM format
 * @returns {string} Formatted time string
 */
function formatTimeForDisplay(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Generate 7 days of dates starting from today
 * @returns {Array} Array of date objects with formatted strings
 */
export function generateDateRange() {
  const dates = [];
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    dates.push({
      date: date.toISOString().split('T')[0], // YYYY-MM-DD format
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: date.getDate(),
      isToday: i === 0,
      isPast: i < 0
    });
  }
  
  return dates;
}

/**
 * Check if a date is in the past
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {boolean} True if date is in the past
 */
export function isDateInPast(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  return checkDate < today;
}

/**
 * Check if a time slot is in the past for today
 * @param {string} time - Time in HH:MM format
 * @returns {boolean} True if time is in the past for today
 */
export function isTimeInPast(time) {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  return time < currentTime;
} 