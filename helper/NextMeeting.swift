// nextmeeting — prints the next Apple Calendar event as JSON on stdout.
//
//   nextmeeting [--hours N] [--calendars "Work,Personal"] [--out FILE]
//
// Output: {"status":"ok","event":{...}} | {"status":"none"} | {"status":"denied"}
// Written to stdout, and to FILE when --out is given (needed when launched
// through `open`, which discards stdout).
// Skips all-day events, cancelled events and events the user has declined.

import EventKit
import Foundation

struct Options {
    var hours: Double = 24
    var calendars: Set<String> = []
    var out: String?
    var listCalendars = false
}

func parseArgs() -> Options {
    var opts = Options()
    var it = CommandLine.arguments.dropFirst().makeIterator()
    while let arg = it.next() {
        switch arg {
        case "--hours":
            if let v = it.next(), let h = Double(v) { opts.hours = h }
        case "--calendars":
            if let v = it.next() {
                opts.calendars = Set(
                    v.split(separator: ",")
                        .map { $0.trimmingCharacters(in: .whitespaces) }
                        .filter { !$0.isEmpty })
            }
        case "--out":
            opts.out = it.next()
        case "--list-calendars":
            opts.listCalendars = true
        default:
            break
        }
    }
    return opts
}

var outPath: String?

func emit(_ obj: [String: Any]) {
    var data = try! JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys])
    data.append("\n".data(using: .utf8)!)
    FileHandle.standardOutput.write(data)
    if let p = outPath {
        try? data.write(to: URL(fileURLWithPath: p), options: .atomic)
    }
}

func requestAccess(_ store: EKEventStore) -> Bool {
    let sem = DispatchSemaphore(value: 0)
    var granted = false
    if #available(macOS 14.0, *) {
        store.requestFullAccessToEvents { ok, _ in
            granted = ok
            sem.signal()
        }
    } else {
        store.requestAccess(to: .event) { ok, _ in
            granted = ok
            sem.signal()
        }
    }
    // The permission prompt is modal; give the user time to answer it.
    _ = sem.wait(timeout: .now() + 120)
    return granted
}

func isDeclined(_ event: EKEvent) -> Bool {
    guard let attendees = event.attendees,
        let me = attendees.first(where: { $0.isCurrentUser })
    else { return false }
    return me.participantStatus == .declined
}

func iso(_ d: Date) -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f.string(from: d)
}

let opts = parseArgs()
outPath = opts.out
let store = EKEventStore()

guard requestAccess(store) else {
    emit(["status": "denied"])
    exit(2)
}

let now = Date()
let end = now.addingTimeInterval(opts.hours * 3600)
var calendars = store.calendars(for: .event)

if opts.listCalendars {
    emit([
        "status": "ok",
        "calendars": calendars.map { ["title": $0.title, "source": $0.source.title] },
    ])
    exit(0)
}

if !opts.calendars.isEmpty {
    calendars = calendars.filter { opts.calendars.contains($0.title) }
}

let predicate = store.predicateForEvents(withStart: now, end: end, calendars: calendars)
let events = store.events(matching: predicate)
    .filter { !$0.isAllDay && $0.status != .canceled && !isDeclined($0) }
    .sorted { $0.startDate < $1.startDate }

// Prefer the next event that hasn't started; fall back to one in progress.
let upcoming = events.first { $0.startDate > now }
let inProgress = events.first { $0.startDate <= now && $0.endDate > now }

guard let ev = upcoming ?? inProgress else {
    emit(["status": "none"])
    exit(0)
}

emit([
    "status": "ok",
    "event": [
        "title": ev.title ?? "(no title)",
        "start": iso(ev.startDate),
        "end": iso(ev.endDate),
        "location": ev.location ?? "",
        "calendar": ev.calendar.title,
        "inProgress": ev.startDate <= now,
    ] as [String: Any],
])
