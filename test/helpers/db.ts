import { Keypair } from '@stellar/stellar-sdk';

import { prisma } from '../../src/db.js';

/** Truncates every table. Call between tests so fixtures never leak across them. */
export async function resetDb(): Promise<void> {
  try {
    // Attempt to truncate tables used in tests. If the database is not
    // available (e.g. Docker not running locally) this will fail; catch
    // the error and rethrow a more actionable message so CI / local runs
    // are easier to debug.
    await prisma.stream.deleteMany();
    await prisma.donor.deleteMany();
    await prisma.ngo.deleteMany();
    await prisma.ngoApplication.deleteMany();
    await prisma.indexerCheckpoint.deleteMany();
  } catch (err) {
    // Preserve the original error message but add context for developers.
    const message = `resetDb failed: ${String(err)}\n` +
      'Ensure the test Postgres is running and DATABASE_URL in .env.test is correct.';
    // Throw a new Error to make the failure obvious in test output.
    throw new Error(message);
  }
}

/**
 * A real, checksum-valid Stellar G-address, derived deterministically from
 * `distinguishingChar` so a given letter always yields the same address and
 * distinct letters yield distinct ones.
 *
 * These used to be `G` + the letter repeated 55 times. That satisfies the
 * `^G[A-Z2-7]{55}$` shape our route validation checks, but it isn't valid
 * StrKey — so anything that actually decodes an address (`new Address(...)`
 * in the event fixtures, for one) rejected it outright. Deriving from a
 * filled seed keeps the "no fixture management" convenience while producing
 * addresses that survive real decoding.
 */
export function fakeAddress(distinguishingChar: string): string {
  const seed = Buffer.alloc(32, distinguishingChar.toUpperCase().charCodeAt(0));
  return Keypair.fromRawEd25519Seed(seed).publicKey();
}
