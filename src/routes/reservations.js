import express from 'express';
import Joi from 'joi';
import { db } from '../db/index.js';
import { reservations, barbers, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { isDateInPast, isTimeInPast } from '../utils/timeSlots.js';
import { addDemoReservation, getDemoReservations } from './barbers.js';

const router = express.Router();

// Use shared demo data from barbers.js

const demoBarbers = [
  {
    id: 'barber-1',
    userId: 'user-1',
    fullName: 'John Smith',
    phone: '555-0101',
    manualLocation: 'Downtown Barbershop',
    openTime: '09:00',
    closeTime: '18:00',
    haircutDuration: 30
  }
];

// Check if we're in demo mode
const isDemoMode = !process.env.DATABASE_URL;

// Validation schema for creating reservations
const createReservationSchema = Joi.object({
  barberId: Joi.string().required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
});

// POST /reservations - Create a new reservation
router.post('/', authenticateToken, requireRole(['client']), async (req, res) => {
  try {
    const { error, value } = createReservationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { barberId, date, time } = value;
    const clientId = req.user.id;

    // Check if date is in the past
    if (isDateInPast(date)) {
      return res.status(400).json({ error: 'Cannot book appointments in the past' });
    }

    // Check if time is in the past for today
    if (date === new Date().toISOString().split('T')[0] && isTimeInPast(time)) {
      return res.status(400).json({ error: 'Cannot book appointments in the past' });
    }

    if (isDemoMode) {
      // Demo mode logic
      const barber = demoBarbers.find(b => b.id === barberId);
      if (!barber) {
        return res.status(404).json({ error: 'Barber not found' });
      }

      // Check if the time is within barber's working hours
      if (time < barber.openTime || time >= barber.closeTime) {
        return res.status(400).json({ 
          error: `Barber is only available between ${barber.openTime} and ${barber.closeTime}` 
        });
      }

      // Check if the slot is already booked
      const existingReservation = getDemoReservations().find(res => 
        res.barberId === barberId && res.date === date && res.time === time
      );

      if (existingReservation) {
        return res.status(409).json({ error: 'This time slot is already booked' });
      }

      // Check if client already has a reservation at this time
      const clientConflict = getDemoReservations().find(res => 
        res.clientId === clientId && res.date === date && res.time === time
      );

      if (clientConflict) {
        return res.status(409).json({ error: 'You already have a reservation at this time' });
      }

      // Create the reservation (add to shared demo data)
      const newReservation = {
        id: `res-${Date.now()}`,
        clientId,
        barberId,
        date,
        time
      };
      addDemoReservation(newReservation);

      res.status(201).json({
        message: 'Reservation created successfully',
        reservation: {
          id: newReservation.id,
          date: newReservation.date,
          time: newReservation.time,
          barberName: barber.fullName,
          barberPhone: barber.phone
        }
      });
      return;
    }

    // Real database logic
    // Verify barber exists
    const barber = await db
      .select({
        id: barbers.id,
        openTime: barbers.openTime,
        closeTime: barbers.closeTime,
        haircutDuration: barbers.haircutDuration
      })
      .from(barbers)
      .where(eq(barbers.id, barberId))
      .limit(1);

    if (barber.length === 0) {
      return res.status(404).json({ error: 'Barber not found' });
    }

    // Check if the time is within barber's working hours
    if (time < barber[0].openTime || time >= barber[0].closeTime) {
      return res.status(400).json({ 
        error: `Barber is only available between ${barber[0].openTime} and ${barber[0].closeTime}` 
      });
    }

    // Check if the slot is already booked
    const existingReservation = await db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.barberId, barberId),
          eq(reservations.date, date),
          eq(reservations.time, time)
        )
      )
      .limit(1);

    if (existingReservation.length > 0) {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // Check if client already has a reservation at this time
    const clientConflict = await db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.clientId, clientId),
          eq(reservations.date, date),
          eq(reservations.time, time)
        )
      )
      .limit(1);

    if (clientConflict.length > 0) {
      return res.status(409).json({ error: 'You already have a reservation at this time' });
    }

    // Create the reservation
    const [newReservation] = await db
      .insert(reservations)
      .values({
        clientId,
        barberId,
        date,
        time
      })
      .returning();

    // Get barber details for response
    const barberDetails = await db
      .select({
        fullName: users.fullName,
        phone: users.phone
      })
      .from(users)
      .where(eq(users.id, barber[0].id))
      .limit(1);

    res.status(201).json({
      message: 'Reservation created successfully',
      reservation: {
        id: newReservation.id,
        date: newReservation.date,
        time: newReservation.time,
        barberName: barberDetails[0]?.fullName || 'Unknown',
        barberPhone: barberDetails[0]?.phone || 'Unknown'
      }
    });

  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reservations - Get user's reservations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    if (isDemoMode) {
      // Demo mode logic
      let userReservations = getDemoReservations().filter(res => res.clientId === userId);

      if (date) {
        const dateSchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
        const { error } = dateSchema.validate(date);
        if (error) {
          return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }
        userReservations = userReservations.filter(res => res.date === date);
      }

      // Add barber info
      const reservationsWithBarberInfo = userReservations.map(reservation => {
        const barber = demoBarbers.find(b => b.id === reservation.barberId);
        return {
          id: reservation.id,
          date: reservation.date,
          time: reservation.time,
          barberName: barber?.fullName || 'Unknown',
          barberPhone: barber?.phone || 'Unknown',
          barberLocation: barber?.manualLocation || 'Unknown'
        };
      });

      res.json({
        reservations: reservationsWithBarberInfo
      });
      return;
    }

    // Real database logic
    let query = db
      .select({
        id: reservations.id,
        date: reservations.date,
        time: reservations.time,
        barberName: users.fullName,
        barberPhone: users.phone,
        barberLocation: barbers.manualLocation
      })
      .from(reservations)
      .innerJoin(barbers, eq(reservations.barberId, barbers.id))
      .innerJoin(users, eq(barbers.userId, users.id))
      .where(eq(reservations.clientId, userId));

    // Filter by date if provided
    if (date) {
      const dateSchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
      const { error } = dateSchema.validate(date);
      if (error) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }
      query = query.where(eq(reservations.date, date));
    }

    const userReservations = await query.orderBy(reservations.date, reservations.time);

    res.json({
      reservations: userReservations.map(reservation => ({
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

// DELETE /reservations/:id - Cancel a reservation
router.delete('/:id', authenticateToken, requireRole(['client']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (isDemoMode) {
      // Demo mode logic
      const reservations = getDemoReservations();
      const reservationIndex = reservations.findIndex(res => 
        res.id === id && res.clientId === userId
      );

      if (reservationIndex === -1) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      const reservation = reservations[reservationIndex];

      // Check if reservation is in the past
      if (isDateInPast(reservation.date)) {
        return res.status(400).json({ error: 'Cannot cancel past reservations' });
      }

      // Remove the reservation
      reservations.splice(reservationIndex, 1);

      res.json({ message: 'Reservation cancelled successfully' });
      return;
    }

    // Real database logic
    // Check if reservation exists and belongs to user
    const reservation = await db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.id, id),
          eq(reservations.clientId, userId)
        )
      )
      .limit(1);

    if (reservation.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Check if reservation is in the past
    if (isDateInPast(reservation[0].date)) {
      return res.status(400).json({ error: 'Cannot cancel past reservations' });
    }

    // Delete the reservation
    await db
      .delete(reservations)
      .where(eq(reservations.id, id));

    res.json({ message: 'Reservation cancelled successfully' });

  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 