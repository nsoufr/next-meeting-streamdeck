#!/bin/sh
# Builds helper/NextMeeting.swift into a minimal .app bundle inside the plugin.
# A bundle (not a bare binary) is required for macOS to show the Calendar
# permission prompt and remember the answer under the helper's own identity.
set -eu

cd "$(dirname "$0")/.."
APP="com.nando.next-meeting.sdPlugin/helper/NextMeeting.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp helper/Info.plist "$APP/Contents/Info.plist"
swiftc -O -framework EventKit -o "$APP/Contents/MacOS/nextmeeting" helper/NextMeeting.swift
codesign --force --sign - "$APP"
echo "built $APP"
