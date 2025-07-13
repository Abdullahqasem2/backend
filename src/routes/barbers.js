import express from 'express';
import Joi from 'joi';
import { db } from '../db/index.js';
import { users, barbers, reservations } from '../db/schema.js';
import { eq, like, and, desc } from 'drizzle-orm';
import { generateTimeSlots, isDateInPast } from '../utils/timeSlots.js';

const router = express.Router();

// Demo data for testing
const demoBarbers = [
  {
    id: 'barber-1',
    userId: 'user-1',
    fullName: 'John Smith',
    email: 'john@barbershop.com',
    phone: '555-0101',
    manualLocation: 'Downtown Barbershop',
    haircutDuration: 30,
    openTime: '09:00',
    closeTime: '18:00'
  },
  {
    id: 'barber-2',
    userId: 'user-2',
    fullName: 'Mike Johnson',
    email: 'mike@barbershop.com',
    phone: '555-0102',
    manualLocation: 'Uptown Cuts',
    haircutDuration: 45,
    openTime: '08:00',
    closeTime: '19:00'
  },
  {
    id: 'barber-3',
    userId: 'user-3',
    fullName: 'David Wilson',
    email: 'david@barbershop.com',
    phone: '555-0103',
    manualLocation: 'Downtown Barbershop',
    haircutDuration: 30,
    openTime: '10:00',
    closeTime: '17:00'
  }
];

// Shared demo reservations data - this should be synchronized with reservations.js
let demoReservations = [
  {
    id: 'res-1',
    barberId: 'barber-1',
    clientId: 'user-1752373590610',
    date: '2024-01-15',
    time: '10:00'
  },
  {
    id: 'res-2',
    barberId: 'barber-1',
    clientId: 'user-1752373590610',
    date: '2024-01-15',
    time: '14:00'
  }
];

// Function to add new reservation (called from reservations.js)
export function addDemoReservation(reservation) {
  demoReservations.push(reservation);
}

// Function to get all demo reservations
export function getDemoReservations() {
  return demoReservations;
}

// Check if we're in demo mode
const isDemoMode = !process.env.DATABASE_URL;

// GET /barbers - Search and filter barbers
router.get('/', async (req, res) => {
  try {
    const { search, location } = req.query;

    // Check demo mode first before any database operations
    if (isDemoMode) {
      // Return demo data
      let filteredBarbers = demoBarbers;

      if (search) {
        filteredBarbers = filteredBarbers.filter(barber => 
          barber.fullName.toLowerCase().includes(search.toLowerCase())
        );
      }

      if (location) {
        filteredBarbers = filteredBarbers.filter(barber => 
          barber.manualLocation.toLowerCase().includes(location.toLowerCase())
        );
      }

      res.json({
        barbers: filteredBarbers
      });
      return;
    }

    // Only execute database query if not in demo mode
    let query = db
      .select({
        id: barbers.id,
        userId: barbers.userId,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        manualLocation: barbers.manualLocation,
        haircutDuration: barbers.haircutDuration,
        openTime: barbers.openTime,
        closeTime: barbers.closeTime
      })
      .from(barbers)
      .innerJoin(users, eq(barbers.userId, users.id));

    // Apply search filters
    if (search) {
      query = query.where(like(users.fullName, `%${search}%`));
    }

    if (location) {
      query = query.where(like(barbers.manualLocation, `%${location}%`));
    }

    const barbersList = await query.orderBy(desc(users.fullName));

    res.json({
      barbers: barbersList.map(barber => ({
        ...barber,
        openTime: barber.openTime,
        closeTime: barber.closeTime
      }))
    });

  } catch (error) {
    console.error('Get barbers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /barbers/:id/schedule - Get available time slots for a barber
router.get('/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    // Validate date parameter
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const dateSchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
    const { error } = dateSchema.validate(date);
    if (error) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Check if date is in the past
    if (isDateInPast(date)) {
      return res.status(400).json({ error: 'Cannot view schedule for past dates' });
    }

    if (isDemoMode) {
      // Return demo data
      const barber = demoBarbers.find(b => b.id === id);
      if (!barber) {
        return res.status(404).json({ error: 'Barber not found' });
      }

      // Get existing reservations for the date
      const existingReservations = getDemoReservations().filter(res => 
        res.barberId === id && res.date === date
      );

      // Generate available time slots
      const timeSlots = generateTimeSlots(
        barber.openTime,
        barber.closeTime,
        barber.haircutDuration,
        existingReservations
      );

      res.json({
        barber: {
          id: barber.id,
          fullName: barber.fullName,
          manualLocation: barber.manualLocation,
          haircutDuration: barber.haircutDuration,
          openTime: barber.openTime,
          closeTime: barber.closeTime
        },
        date,
        timeSlots
      });
      return;
    }

    // Real database query
    const barber = await db
      .select({
        id: barbers.id,
        userId: barbers.userId,
        fullName: users.fullName,
        manualLocation: barbers.manualLocation,
        haircutDuration: barbers.haircutDuration,
        openTime: barbers.openTime,
        closeTime: barbers.closeTime
      })
      .from(barbers)
      .innerJoin(users, eq(barbers.userId, users.id))
      .where(eq(barbers.id, id))
      .limit(1);

    if (barber.length === 0) {
      return res.status(404).json({ error: 'Barber not found' });
    }

    // Get existing reservations for the date
    const existingReservations = await db
      .select({
        time: reservations.time
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.barberId, id),
          eq(reservations.date, date)
        )
      );

    // Generate available time slots
    const timeSlots = generateTimeSlots(
      barber[0].openTime,
      barber[0].closeTime,
      barber[0].haircutDuration,
      existingReservations
    );

    res.json({
      barber: {
        id: barber[0].id,
        fullName: barber[0].fullName,
        manualLocation: barber[0].manualLocation,
        haircutDuration: barber[0].haircutDuration,
        openTime: barber[0].openTime,
        closeTime: barber[0].closeTime
      },
      date,
      timeSlots
    });

  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /barbers/:id/reservations - Get barber's reservations
router.get('/:id/reservations', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (isDemoMode) {
      // Return demo data
      let filteredReservations = getDemoReservations().filter(res => res.barberId === id);

      if (date) {
        const dateSchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
        const { error } = dateSchema.validate(date);
        if (error) {
          return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }
        filteredReservations = filteredReservations.filter(res => res.date === date);
      }

      // Add client info (mock data)
      const reservationsWithClientInfo = filteredReservations.map(reservation => ({
        id: reservation.id,
        date: reservation.date,
        time: reservation.time,
        clientName: 'Demo Client',
        clientPhone: '555-0000',
        clientEmail: 'demo@example.com'
      }));

      res.json({
        reservations: reservationsWithClientInfo
      });
      return;
    }

    // Real database query
    let query = db
      .select({
        id: reservations.id,
        date: reservations.date,
        time: reservations.time,
        clientName: users.fullName,
        clientPhone: users.phone,
        clientEmail: users.email
      })
      .from(reservations)
      .innerJoin(users, eq(reservations.clientId, users.id))
      .where(eq(reservations.barberId, id));

    // Filter by date if provided
    if (date) {
      const dateSchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
      const { error } = dateSchema.validate(date);
      if (error) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }
      query = query.where(eq(reservations.date, date));
    }

    const reservationsList = await query.orderBy(reservations.date, reservations.time);

    res.json({
      reservations: reservationsList.map(reservation => ({
        ...reservation,
        date: reservation.date,
        time: reservation.time
      }))
    });

  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 