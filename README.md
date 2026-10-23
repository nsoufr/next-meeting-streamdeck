# Next Meeting — Stream Deck Neo infobar

Shows your next Apple Calendar event on the Stream Deck Neo's infobar:

```
┌──────────────────────────────────────┐
│ ▦  Weekly sync                        │
│    in 12 min · 14:30–15:00            │
└──────────────────────────────────────┘
```

Second line variants: `Now · ends 15:00`, `16:30 · in 2 h 30 min`,
`Tomorrow 09:00`, `Mon 09:00`, `Nothing in the next 7 days`.

Display only — the infobar takes no input on Stream Deck 7.6.

## Requirements

- macOS 14+, Stream Deck app 7.6+, a Stream Deck Neo
- Node 20+, Swift toolchain (Xcode or Command Line Tools)
- `npm i -g @elgato/cli`

## Build & install

```sh
npm install
npm run build          # Swift helper (.app bundle) + plugin bundle
streamdeck dev         # once: lets the CLI restart plugins
npm run link           # symlinks the .sdPlugin folder into Stream Deck
npm run restart
```

Then, in the Stream Deck app, select the Neo and drag **Next Meeting →
Next Meeting** onto the infobar. The first time, macOS asks for Calendar
access under the name "Next Meeting (Stream Deck)" — click **Allow**.

## How it works

```
Stream Deck ──► bin/plugin.js (Node)
                   │  every 5 min, and when the current meeting ends
                   ▼
                /usr/bin/open -W -n -a helper/NextMeeting.app --args --out <tmp.json>
                   │  EventKit, all calendars in Calendar.app
                   ▼
                tmp.json ──► setFeedback({ name, when })   (redrawn every 60 s)
```

- `helper/NextMeeting.swift` queries EventKit for the next non-all-day,
  non-cancelled, non-declined event (in-progress events count as fallback).
- The helper is a minimal `.app` bundle launched through `open`, not a bare
  binary spawned by the plugin. A bare binary gets no permission prompt and a
  silent `false` from `requestFullAccessToEvents`; a bundle with
  `NSCalendarsFullAccessUsageDescription` gets its own prompt and TCC entry,
  independent of Stream Deck's.
- `open` discards stdout, so the helper writes its JSON to `--out`.
- `layouts/infobar.json` is the 232×50 layout (icon, name, when). It is
  applied with `setFeedbackLayout` on every `willAppear`, as the SDK requires.

Helper CLI (useful for debugging):

```sh
H=com.nando.next-meeting.sdPlugin/helper/NextMeeting.app
open -W -n -a $H --args --list-calendars --out /tmp/c.json && cat /tmp/c.json
open -W -n -a $H --args --hours 168 --out /tmp/n.json && cat /tmp/n.json
```

## Troubleshooting

- **"Calendar access needed"** on the infobar: System Settings › Privacy &
  Security › Calendars › enable "Next Meeting (Stream Deck)". If it is not
  listed, run one of the helper commands above to trigger the prompt.
- **Re-prompted after rebuilding the helper**: the helper is ad-hoc signed,
  so its code hash changes on every build and macOS may ask again. Sign with
  a stable identity (`codesign -s "Apple Development: …"` in
  `helper/build.sh`) to avoid this.
- Plugin log: `com.nando.next-meeting.sdPlugin/logs/`.
  Stream Deck log: `~/Library/Logs/ElgatoStreamDeck/StreamDeck.log`.

## Ideas

- Calendar filter in the property inspector (`--calendars` is already
  supported by the helper).
- Change the icon colour when the meeting is < 5 min away.
