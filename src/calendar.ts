import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type NextEvent = {
	title: string;
	start: Date;
	end: Date;
	location: string;
	calendar: string;
	inProgress: boolean;
};

export type CalendarResult =
	| { status: "ok"; event: NextEvent }
	| { status: "none" }
	| { status: "denied" }
	| { status: "error"; message: string };

type HelperOutput =
	| { status: "ok"; event: { title: string; start: string; end: string; location: string; calendar: string; inProgress: boolean } }
	| { status: "none" }
	| { status: "denied" };

// bin/plugin.js lives next to helper/ inside the .sdPlugin folder.
const HELPER_APP = path.resolve(__dirname, "..", "helper", "NextMeeting.app");

// The helper waits up to 120 s for the macOS permission prompt.
const HELPER_TIMEOUT_MS = 130_000;

function run(cmd: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		execFile(cmd, args, { timeout: HELPER_TIMEOUT_MS }, (err, _stdout, stderr) => {
			if (err) reject(new Error(stderr.trim() || err.message));
			else resolve();
		});
	});
}

/**
 * Runs the EventKit helper and returns the next event.
 *
 * The helper is launched through `open` so macOS treats it as its own app
 * (own permission prompt and TCC entry) instead of a child of Stream Deck.
 * `open` discards stdout, so the helper writes its JSON to a temp file.
 */
export async function fetchNextEvent(hours = 7 * 24, calendars: string[] = []): Promise<CalendarResult> {
	const outFile = path.join(os.tmpdir(), `next-meeting-${randomUUID()}.json`);
	const args = ["-W", "-n", "-a", HELPER_APP, "--args", "--hours", String(hours), "--out", outFile];
	if (calendars.length > 0) {
		args.push("--calendars", calendars.join(","));
	}

	try {
		await run("/usr/bin/open", args);
		const raw = await readFile(outFile, "utf8");
		const out = JSON.parse(raw.trim()) as HelperOutput;
		if (out.status !== "ok") return out;
		return {
			status: "ok",
			event: {
				...out.event,
				start: new Date(out.event.start),
				end: new Date(out.event.end),
			},
		};
	} catch (e) {
		return { status: "error", message: (e as Error).message };
	} finally {
		await unlink(outFile).catch(() => undefined);
	}
}
