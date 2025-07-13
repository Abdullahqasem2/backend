import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

let db;

if (!connectionString) {
  console.warn('DATABASE_URL not found, using demo mode with in-memory data');
  // For demo purposes, we'll create a mock database that mimics Drizzle ORM
  const mockQueryBuilder = {
    from: () => ({
      where: () => Promise.resolve([]),
      limit: () => Promise.resolve([]),
      orderBy: () => Promise.resolve([]),
      innerJoin: () => ({
        where: () => Promise.resolve([]),
        limit: () => Promise.resolve([]),
        orderBy: () => Promise.resolve([])
      })
    }),
    where: () => Promise.resolve([]),
    limit: () => Promise.resolve([]),
    orderBy: () => Promise.resolve([])
  };

  db = {
    select: () => mockQueryBuilder,
    insert: () => ({
      values: () => Promise.resolve([{ id: 'demo-id' }]),
      returning: () => Promise.resolve([{ id: 'demo-id' }])
    }),
    delete: () => ({
      where: () => Promise.resolve()
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve()
      })
    })
  };
} else {
  // Create postgres connection with SSL required for Render
  const client = postgres(connectionString, { ssl: 'require' });
  
  // Create drizzle instance
  db = drizzle(client, { schema });
}

export { db };
export default db; 