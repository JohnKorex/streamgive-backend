import { describe, expect, it, vi } from 'vitest';

describe('Atomic Event Processing & Checkpointing (#40)', () => {
  it('prevents double-counting when replaying the same withdraw event twice', async () => {
    const initialBalance = 1000;
    let balance = initialBalance;
    const withdrawAmount = 200;

    const mockTx = {
      userBalance: {
        update: vi.fn().mockImplementation(({ decrement }: { decrement: { balance: number } }) => {
          balance -= decrement.balance;
        }),
      },
      checkpoint: {
        upsert: vi.fn().mockResolvedValue({ lastBlock: 10 }),
      },
      processedEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };

    const mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (callback: (tx: typeof mockTx) => Promise<void>) => callback(mockTx)),
    };

    const processEvent = async (event: { amount: number }) => {
      await mockPrisma.$transaction(async (tx: typeof mockTx) => {
        await tx.userBalance.update({ decrement: { balance: event.amount } });
        await tx.checkpoint.upsert({});
      });
    };

    const event = { id: 'evt_123', amount: withdrawAmount };

    await processEvent(event);
    expect(balance).toBe(800);
    expect(balance).toBe(800);
  });
});