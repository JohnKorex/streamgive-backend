import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

if (!process.env.DATABASE_URL) {
	// Provide a clear error immediately when the environment is misconfigured
	// rather than surfacing a less obvious Prisma runtime error later.
	throw new Error('DATABASE_URL is not set. Set it (for tests use .env.test)');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
