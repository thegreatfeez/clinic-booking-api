import { ApiError } from "../api";

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "This page can't reach the booking service. The API key is missing or wrong.";
    }

    if (error.status === 429) {
      return `Too many booking attempts for that email. Try again in ${error.retryAfter ?? 60} seconds.`;
    }

    if (error.status === 409) {
      return "That time was just booked by someone else. Pick another slot.";
    }

    if (error.status === 404) {
      return "That time is no longer listed. Refresh the times and pick another.";
    }

    return error.message;
  }

  return "Couldn't reach the booking service. Check your connection and try again.";
}
