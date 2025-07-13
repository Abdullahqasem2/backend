import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

async function runMigration() {
  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(process.cwd(), 'drizzle', '0000_tense_hellion.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration...');
    await client.unsafe(migrationSQL);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

runMigration(); 