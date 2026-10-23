import type { Slot } from "../api";

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long"
});

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });

const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short" });

const todayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long"
});

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function formatRange(slot: Slot): string {
  return `${formatTime(slot.start)} – ${formatTime(slot.end)}`;
}

export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}

export function formatDayKey(iso: string): string {
  return dayFormat.format(new Date(iso));
}

export function formatWeekday(iso: string): string {
  return weekdayFormat.format(new Date(iso));
}

export function formatDayNumber(iso: string): string {
  return String(new Date(iso).getDate());
}

export function formatMonth(iso: string): string {
  return monthFormat.format(new Date(iso));
}

export function formatToday(): string {
  return todayFormat.format(new Date());
}

export function relativeDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

  const difference = Math.round((startOfDay(date) - startOfDay(today)) / 86_400_000);

  if (difference === 0) {
    return "Today";
  }

  if (difference === 1) {
    return "Tomorrow";
  }

  return dayFormat.format(date);
}

export function durationMinutes(slot: Slot): number {
  return Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60_000);
}

export function hasStarted(slot: Slot): boolean {
  return new Date(slot.start).getTime() <= Date.now();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}
