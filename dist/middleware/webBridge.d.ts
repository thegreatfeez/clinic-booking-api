import type { RequestHandler } from "express";
/**
 * Lets the browser page call the same API routes without ever receiving the
 * server-side API key. The key is injected here, on the server, and the
 * destructive /reset route is not exposed through this bridge.
 */
export declare const webBridge: RequestHandler;
//# sourceMappingURL=webBridge.d.ts.map