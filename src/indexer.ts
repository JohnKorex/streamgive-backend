type RpcEvent = {
  id: string;
  ledger?: number;
};

type RpcClient = {
  getEvents: (args: {
    cursor?: string;
    limit?: number;
    startLedger?: number;
    filters?: Array<Record<string, unknown>>;
  }) => Promise<{
    events?: RpcEvent[];
    nextCursor?: string | null;
  }>;
};

export function startIndexer(pollOnce: () => Promise<void>, intervalMs: number) {
  let timeoutId: NodeJS.Timeout | null = null;
  let isStopped = false;
  let isPolling = false;

  const poll = async () => {
    if (isStopped) return;

    if (isPolling) {
      scheduleNext();
      return;
    }

    isPolling = true;
    try {
      await pollOnce();
    } catch (error) {
      console.error('Error during indexer poll:', error);
    } finally {
      isPolling = false;
      scheduleNext();
    }
  };

  const scheduleNext = () => {
    if (isStopped) return;
    timeoutId = setTimeout(poll, intervalMs);
  };

  void poll();

  return () => {
    isStopped = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

export async function pollOnce(
  rpcClient: RpcClient,
  processEvent: (event: RpcEvent) => Promise<void>,
): Promise<void> {
  let currentCursor = '';
  const PAGE_LIMIT = 100;
  let hasMore = true;

  while (hasMore) {
    const response = await rpcClient.getEvents({
      cursor: currentCursor || undefined,
      limit: PAGE_LIMIT,
    });

    const events = response.events ?? [];

    for (const event of events) {
      await processEvent(event);
      currentCursor = event.id;
    }

    if (events.length < PAGE_LIMIT || !response.nextCursor) {
      hasMore = false;
    } else {
      currentCursor = response.nextCursor;
    }
  }
}