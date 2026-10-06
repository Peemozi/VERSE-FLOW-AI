/** Exponential backoff for STT reconnect — never throws. */
export class ReconnectBackoff {
  private attempt = 0;

  constructor(
    private readonly baseMs = 1000,
    private readonly maxMs = 30_000,
  ) {}

  reset(): void {
    this.attempt = 0;
  }

  /** Next delay in ms; increments attempt. */
  nextDelayMs(): number {
    const exp = Math.min(this.maxMs, this.baseMs * 2 ** this.attempt);
    this.attempt += 1;
    // Full jitter
    return Math.floor(Math.random() * exp);
  }

  getAttempt(): number {
    return this.attempt;
  }
}
