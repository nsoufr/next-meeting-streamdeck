import streamDeck, {
	action,
	SingletonAction,
	type NeoInfobarAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { fetchNextEvent, type CalendarResult } from "../calendar";
import { toFeedback } from "../format";

type Settings = Record<string, never>;

const LAYOUT = "layouts/infobar.json";
const REFRESH_MS = 5 * 60_000; // ask EventKit again
const TICK_MS = 60_000; // redraw the countdown

/**
 * Shows the next Apple Calendar event on the Neo infobar.
 */
@action({ UUID: "com.nando.next-meeting.infobar" })
export class NextMeeting extends SingletonAction<Settings> {
	private readonly visible = new Set<NeoInfobarAction<Settings>>();
	private last: CalendarResult = { status: "none" };
	private refreshTimer?: NodeJS.Timeout;
	private tickTimer?: NodeJS.Timeout;
	private fetching = false;

	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		if (!ev.action.isNeoInfobar()) return;

		// The docs require the layout to be set on every willAppear.
		await ev.action.setFeedbackLayout(LAYOUT);
		this.visible.add(ev.action);

		if (this.visible.size === 1) this.start();
		await this.render(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<Settings>): void {
		// The disappear event only carries an ActionContext, so match by id.
		for (const a of this.visible) {
			if (a.id === ev.action.id) this.visible.delete(a);
		}
		if (this.visible.size === 0) this.stop();
	}

	private start(): void {
		void this.refresh();
		this.refreshTimer = setInterval(() => void this.refresh(), REFRESH_MS);
		this.tickTimer = setInterval(() => void this.renderAll(), TICK_MS);
	}

	private stop(): void {
		clearInterval(this.refreshTimer);
		clearInterval(this.tickTimer);
		this.refreshTimer = this.tickTimer = undefined;
	}

	private async refresh(): Promise<void> {
		if (this.fetching) return;
		this.fetching = true;
		try {
			this.last = await fetchNextEvent();
			// Status only: titles and locations are personal data and don't belong in logs.
			const at = this.last.status === "ok" ? ` at ${this.last.event.start.toISOString()}` : "";
			streamDeck.logger.info(`next event: ${this.last.status}${at}`);
		} finally {
			this.fetching = false;
		}
		await this.renderAll();

		// Once the current meeting ends, fetch the following one right away.
		if (this.last.status === "ok") {
			const wait = this.last.event.end.getTime() - Date.now();
			if (wait > 0 && wait < REFRESH_MS) {
				setTimeout(() => void this.refresh(), wait + 1000);
			}
		}
	}

	private async renderAll(): Promise<void> {
		await Promise.all([...this.visible].map((a) => this.render(a)));
	}

	private async render(a: NeoInfobarAction<Settings>): Promise<void> {
		await a.setFeedback(toFeedback(this.last));
	}
}
