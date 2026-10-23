export interface RateLimitResult {
    allowed: boolean;
    retryAfter: number;
}
export declare function consumeBookingAttempt(email: string): Promise<RateLimitResult>;
//# sourceMappingURL=rateLimit.d.ts.map