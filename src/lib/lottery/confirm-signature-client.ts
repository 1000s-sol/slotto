export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isOnChainFailureError(error: string | null): boolean {
  if (!error) return false;
  if (error === "Confirmation timed out") return false;
  if (error === "Confirm request failed") return false;
  return error.startsWith("{") || error.startsWith("[");
}

export type ConfirmPollResult = {
  confirmed: boolean;
  error: string | null;
};

/** Retry short server polls until confirmed, on-chain failure, or deadline. */
export async function confirmSignatureWithRetry(
  pollOnce: (maxWaitMs: number) => Promise<ConfirmPollResult>,
  deadlineMs = 90_000,
): Promise<ConfirmPollResult> {
  const deadline = Date.now() + deadlineMs;
  let lastError: string | null = null;

  while (Date.now() < deadline) {
    try {
      const result = await pollOnce(8_000);
      if (result.confirmed) {
        return result;
      }
      if (isOnChainFailureError(result.error)) {
        return result;
      }
      lastError = result.error;
    } catch {
      lastError = "Confirm request failed";
    }
    await sleep(1_500);
  }

  return {
    confirmed: false,
    error: lastError ?? "Confirmation timed out",
  };
}
