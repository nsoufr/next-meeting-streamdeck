import type { CalendarResult, NextEvent } from "./calendar";

export type Feedback = { name: string; when: string };

const MIN = 60_000;

function hhmm(d: Date): string {
	return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function isSameDay(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function relative(ms: number): string {
	const mins = Math.max(1, Math.round(ms / MIN));
	if (mins < 60) return `in ${mins} min`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m === 0 ? `in ${h} h` : `in ${h} h ${m} min`;
}

/**
 * Second line of the infobar for a single event, relative to `now`.
 */
export function describeWhen(ev: NextEvent, now: Date): string {
	if (ev.start <= now && ev.end > now) {
		return `Now · ends ${hhmm(ev.end)}`;
	}
	const until = ev.start.getTime() - now.getTime();
	if (!isSameDay(ev.start, now)) {
		const tomorrow = new Date(now);
		tomorrow.setDate(now.getDate() + 1);
		const day = isSameDay(ev.start, tomorrow)
			? "Tomorrow"
			: ev.start.toLocaleDateString(undefined, { weekday: "short" });
		return `${day} ${hhmm(ev.start)}`;
	}
	if (until < 60 * MIN) {
		return `${relative(until)} · ${hhmm(ev.start)}–${hhmm(ev.end)}`;
	}
	return `${hhmm(ev.start)} · ${relative(until)}`;
}

/**
 * Maps a helper result onto the two infobar text items.
 */
export function toFeedback(result: CalendarResult, now = new Date()): Feedback {
	switch (result.status) {
		case "ok":
			return { name: result.event.title, when: describeWhen(result.event, now) };
		case "none":
			return { name: "No meetings", when: "Nothing in the next 7 days" };
		case "denied":
			return { name: "Calendar access needed", when: "System Settings › Privacy › Calendars" };
		case "error":
			return { name: "Calendar error", when: result.message.slice(0, 40) };
	}
}
