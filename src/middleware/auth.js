import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Demo user data for testing
const demoUsers = [
  {
    id: 'user-1752374346100',
    role: 'client',
    email: 'client@example.com',
    fullName: 'Test Client',
    phone: '1234567890'
  }
];

// In-memory token blacklist for demo mode
const blacklistedTokens = new Set();

// Check if we're in demo mode
const isDemoMode = !process.env.DATABASE_URL;

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Check if token is blacklisted (demo mode)
    if (isDemoMode && blacklistedTokens.has(token)) {
      return res.status(401).json({ error: 'Token has been invalidated' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'demo-secret-key-for-testing';
    const decoded = jwt.verify(token, jwtSecret);
    
    if (isDemoMode) {
      // Use demo user data
      const user = demoUsers.find(u => u.id === decoded.userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      req.user = user;
      next();
      return;
    }

    // Get user from database
    const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    
    if (!user.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user[0];
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Function to blacklist a token (used by logout endpoint)
export const blacklistToken = (token) => {
  if (isDemoMode) {
    blacklistedTokens.add(token);
  }
}; 