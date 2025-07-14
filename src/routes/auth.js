import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { db } from '../db/index.js';
import { users, barbers } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { demoData } from '../utils/demoData.js';
import { authenticateToken, blacklistToken } from '../middleware/auth.js';

const router = express.Router();



// Validation schemas
const signupSchema = Joi.object({
  role: Joi.string().valid('client', 'barber').required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  fullName: Joi.string().min(2).required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).required(),
  // Barber-specific fields
  manualLocation: Joi.when('role', {
    is: 'barber',
    then: Joi.string().required(),
    otherwise: Joi.forbidden()
  }),
  haircutDuration: Joi.when('role', {
    is: 'barber',
    then: Joi.number().integer().min(15).max(120).default(30),
    otherwise: Joi.forbidden()
  }),
  openTime: Joi.when('role', {
    is: 'barber',
    then: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    otherwise: Joi.forbidden()
  }),
  closeTime: Joi.when('role', {
    is: 'barber',
    then: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    otherwise: Joi.forbidden()
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { error, value } = signupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { role, email, password, fullName, phone, manualLocation, haircutDuration, openTime, closeTime } = value;

    // Check if user already exists
    if (process.env.DATABASE_URL) {
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    } else {
      // Demo mode
      const existingUser = demoData.findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    let newUser;
    if (process.env.DATABASE_URL) {
      [newUser] = await db.insert(users).values({
        role,
        email,
        passwordHash,
        fullName,
        phone
      }).returning();

      // If barber, create barber profile
      if (role === 'barber') {
        await db.insert(barbers).values({
          userId: newUser.id,
          manualLocation,
          haircutDuration,
          openTime,
          closeTime
        });
      }
    } else {
      // Demo mode
      newUser = demoData.createUser({
        role,
        email,
        passwordHash,
        fullName,
        phone
      });

      // If barber, create barber profile
      if (role === 'barber') {
        demoData.createBarber({
          userId: newUser.id,
          manualLocation,
          haircutDuration,
          openTime,
          closeTime
        });
      }
    }

    // Get barber ID if user is a barber
    let barberId = null;
    if (role === 'barber') {
      if (process.env.DATABASE_URL) {
        const barberResult = await db.select({ id: barbers.id }).from(barbers).where(eq(barbers.userId, newUser.id)).limit(1);
        if (barberResult.length > 0) {
          barberId = barberResult[0].id;
        }
      } else {
        // Demo mode
        const barber = demoData.getBarbers().find(b => b.userId === newUser.id);
        if (barber) {
          barberId = barber.id;
        }
      }
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'demo-secret-key-for-testing';
    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: newUser.id,
        role: newUser.role,
        email: newUser.email,
        fullName: newUser.fullName,
        phone: newUser.phone,
        barberId
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    // Find user
    let user;
    if (process.env.DATABASE_URL) {
      const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (userResult.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      user = userResult[0];
    } else {
      // Demo mode
      user = demoData.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get barber ID if user is a barber
    let barberId = null;
    if (user.role === 'barber') {
      if (process.env.DATABASE_URL) {
        const barberResult = await db.select({ id: barbers.id }).from(barbers).where(eq(barbers.userId, user.id)).limit(1);
        if (barberResult.length > 0) {
          barberId = barberResult[0].id;
        }
      } else {
        // Demo mode
        const barber = demoData.getBarbers().find(b => b.userId === user.id);
        if (barber) {
          barberId = barber.id;
        }
      }
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'demo-secret-key-for-testing';
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        barberId
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token) {
      // Add token to blacklist
      blacklistToken(token);
    }

    res.json({
      message: 'Logout successful',
      user: {
        id: req.user.id,
        email: req.user.email,
        fullName: req.user.fullName
      }
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me - Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        role: req.user.role,
        email: req.user.email,
        fullName: req.user.fullName,
        phone: req.user.phone
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 