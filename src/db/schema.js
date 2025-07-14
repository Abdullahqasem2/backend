import { pgTable, uuid, varchar, text, timestamp, time, date, integer, pgEnum, boolean as pgBoolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum for user roles
export const userRoleEnum = pgEnum('user_role', ['client', 'barber']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: userRoleEnum('role').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Barbers table (extends users)
export const barbers = pgTable('barbers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  manualLocation: text('manual_location').notNull(),
  haircutDuration: integer('haircut_duration').notNull().default(30), // in minutes
  openTime: time('open_time').notNull(),
  closeTime: time('close_time').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Barber shops table
export const barberShops = pgTable('barber_shops', {
  id: uuid('id').primaryKey().defaultRandom(),
  barberId: uuid('barber_id').references(() => barbers.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Reservations table
export const reservations = pgTable('reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  barberId: uuid('barber_id').references(() => barbers.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  time: time('time').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Barber availability table
export const barberAvailability = pgTable('barber_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  barberId: uuid('barber_id').references(() => barbers.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  isAvailable: pgBoolean('is_available').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Unavailable time slots table
export const unavailableTimeSlots = pgTable('unavailable_time_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  barberId: uuid('barber_id').references(() => barbers.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  time: time('time').notNull(),
  isUnavailable: pgBoolean('is_unavailable').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  barber: one(barbers, {
    fields: [users.id],
    references: [barbers.userId],
  }),
  clientReservations: many(reservations, { relationName: 'clientReservations' }),
}));

export const barbersRelations = relations(barbers, ({ one, many }) => ({
  user: one(users, {
    fields: [barbers.userId],
    references: [users.id],
  }),
  barberShops: many(barberShops),
  barberReservations: many(reservations, { relationName: 'barberReservations' }),
  barberAvailability: many(barberAvailability),
  unavailableTimeSlots: many(unavailableTimeSlots),
}));

export const barberShopsRelations = relations(barberShops, ({ one }) => ({
  barber: one(barbers, {
    fields: [barberShops.barberId],
    references: [barbers.id],
  }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  client: one(users, {
    fields: [reservations.clientId],
    references: [users.id],
    relationName: 'clientReservations',
  }),
  barber: one(barbers, {
    fields: [reservations.barberId],
    references: [barbers.id],
    relationName: 'barberReservations',
  }),
}));

export const barberAvailabilityRelations = relations(barberAvailability, ({ one }) => ({
  barber: one(barbers, {
    fields: [barberAvailability.barberId],
    references: [barbers.id],
  }),
}));

export const unavailableTimeSlotsRelations = relations(unavailableTimeSlots, ({ one }) => ({
  barber: one(barbers, {
    fields: [unavailableTimeSlots.barberId],
    references: [barbers.id],
  }),
})); 