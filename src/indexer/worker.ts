import { getLatestLedgerSequence, rpcServer } from '../stellar/rpc.js';
import { getCheckpoint, saveCheckpoint } from './checkpoint.js';
import { WATCHED_CONTRACT_IDS } from './contracts.js';

const POLL_INTERVAL_MS = Number(process.env.INDEXER_POLL_INTERVAL_MS ?? 5000);
const START_LEDGER = process.env.INDEXER_START_LEDGER
  ? Number(process.env.INDEXER_START_LEDGER)
  : undefined;

type GetEventsResult = Awaited<ReturnType<typeof rpcServer.getEvents>>;
export type ContractEvent = GetEventsResult['events'][number];
export type EventHandler = (event: ContractEvent) => Promise<void>;

let lastProcessedLedger: number | undefined;

function isLedgerOutOfRange(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string' &&
    (err as { message: string }).message.includes(
      'startLedger must be within the ledger range',
    )
  );
}

async function pollOnce(handleEvent: EventHandler): Promise<void> {
  if (WATCHED_CONTRACT_IDS.length === 0) {
    return;
  }

  if (lastProcessedLedger === undefined) {
    const saved = await getCheckpoint();

    if (saved !== undefined) {
      lastProcessedLedger = saved;
    } else {
      lastProcessedLedger = START_LEDGER ?? (await getLatestLedgerSequence());
      await saveCheckpoint(lastProcessedLedger);
      return;
    }
  }

  const latestLedger = await getLatestLedgerSequence();

  if (lastProcessedLedger >= latestLedger) {
    return;
  }

  let events: ContractEvent[];

  try {
    ({ events } = await rpcServer.getEvents({
      startLedger: lastProcessedLedger + 1,
      filters: [
        {
          type: 'contract',
          contractIds: WATCHED_CONTRACT_IDS,
        },
      ],
    }));
  } catch (err: unknown) {
    if (isLedgerOutOfRange(err)) {
      console.warn(
        `indexer: checkpoint ${lastProcessedLedger} has aged out of the RPC's` +
          ` retention window — skipping to ledger ${latestLedger}. Events in` +
          ` between were missed and will not be indexed.`,
      );

      lastProcessedLedger = latestLedger;
      await saveCheckpoint(lastProcessedLedger);
      return;
    }

    throw err;
  }

  if (events.length === 0) {
    lastProcessedLedger = latestLedger;
    await saveCheckpoint(lastProcessedLedger);
    return;
  }

  for (const event of events) {
    await handleEvent(event);
    lastProcessedLedger = event.ledger;
    await saveCheckpoint(lastProcessedLedger);
  }
}

export function startIndexer(handleEvent: EventHandler): () => Promise<void> {
  if (WATCHED_CONTRACT_IDS.length === 0) {
    console.warn(
      'indexer: NGO_REGISTRY_CONTRACT_ID and DONATION_VAULT_CONTRACT_ID are both unset — no-op until at least one is set. See ENVIRONMENT.md.',
    );
  }

  const inFlightPolls = new Set<Promise<void>>();
  const interval = setInterval(() => {
    const pollPromise = pollOnce(handleEvent).catch((err: unknown) => {
      console.error('indexer poll failed', err);
    });

    inFlightPolls.add(pollPromise);
    void pollPromise.finally(() => {
      inFlightPolls.delete(pollPromise);
    });
  }, POLL_INTERVAL_MS);

  void pollOnce(handleEvent).catch((err: unknown) => {
    console.error('indexer poll failed', err);
  });

  return async () => {
    clearInterval(interval);
    await Promise.allSettled([...inFlightPolls]);
  };
}

