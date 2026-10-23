import streamDeck from "@elgato/streamdeck";

import { NextMeeting } from "./actions/next-meeting";

streamDeck.actions.registerAction(new NextMeeting());
streamDeck.connect();
