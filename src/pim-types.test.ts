// SPDX-FileCopyrightText: © 2017 EteSync Authors
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, it } from "vitest";

import { EventType, timezoneLoadFromName } from "./pim-types";

const ics = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:test-event",
  "SUMMARY:Dentist",
  "DTSTART:20261012T100000Z",
  "DTEND:20261012T113000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

it("keeps the color an event is shown with out of the event", () => {
  const event = EventType.parse(ics);
  expect(event.color).toBeUndefined();

  event.color = "#ff0000";
  expect(event.color).toBe("#ff0000");
  expect(event.clone().color).toBe("#ff0000");
  expect(event.toIcal()).not.toMatch(/^COLOR/m);
  expect(event.summary).toBe("Dentist");
});

it("loads time zones by their name and by their aliases", () => {
  expect(timezoneLoadFromName("Europe/Berlin")?.tzid).toBe("Europe/Berlin");
  // An alias of Australia/Darwin
  expect(timezoneLoadFromName("AUS Central Standard Time")).not.toBeNull();
  expect(timezoneLoadFromName("Not/A_Zone")).toBeNull();
  expect(timezoneLoadFromName(null)).toBeNull();
});
