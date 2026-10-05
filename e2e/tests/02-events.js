// Calendar: adding, showing, editing and deleting events, and getting the ones added elsewhere
const { api, check, day, icalDay, itemsWith, open, run, unique } = require("../lib");

run(async () => {
  const app = await open();
  const { page } = app;
  await app.loginToPim();
  await page.getByRole("tab", { name: "Calendar" }).click();
  await page.waitForURL(/\/pim\/events$/);

  // A new event
  const title = `Dentist ${unique()}`;
  await page.locator("button[class*=Fab]").click();
  await page.waitForURL(/\/events\/new/);
  await page.locator("input[name=title]").fill(title);
  const dates = page.locator("input[type=text]:not([name])");
  await app.typeDate(dates.nth(0), `${day(2)} 10:00`);
  await app.typeDate(dates.nth(1), `${day(2)} 11:30`);
  check("the start date is taken as typed", (await dates.nth(0).inputValue()) === `${day(2)} 10:00`, await dates.nth(0).inputValue());
  await page.locator("input[name=location]").fill("Main street 1");
  await page.locator("textarea[name=description]").fill("Bring the card");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/pim\/events$/);
  await app.synced();

  let saved = await itemsWith("etebase.vevent", `SUMMARY:${title}`);
  check("the event is on the server", saved.length === 1, saved.length);
  const ics = saved[0] || "";
  check("with its start", new RegExp(`DTSTART;TZID=[^:]+:${icalDay(2)}T100000`).test(ics), ics);
  check("with its end", new RegExp(`DTEND;TZID=[^:]+:${icalDay(2)}T113000`).test(ics), ics);
  check("with its location", ics.includes("LOCATION:Main street 1"), ics);
  check("with its description", ics.includes("DESCRIPTION:Bring the card"), ics);
  check("with its time zone", ics.includes("BEGIN:VTIMEZONE"), ics);
  check("without the color the app shows it in", !/^COLOR/m.test(ics), ics);

  // Shown in the calendar, and on its own page
  await page.getByRole("button", { name: "Agenda" }).click();
  check("the event is in the agenda", await page.getByText(title).isVisible());
  check("at its time", (await page.locator("tr", { hasText: title }).innerText()).includes("10:00 – 11:30"), await page.locator("tr", { hasText: title }).innerText());
  await page.getByText(title).click();
  await page.waitForURL(/\/pim\/events\/[^/]+$/);
  const shown = await page.innerText("body");
  check("the event page shows its title", shown.includes(title), shown);
  check("the event page shows its location", shown.includes("Main street 1"), shown);
  check("the event page shows its description", shown.includes("Bring the card"), shown);
  check("the event page shows its time", shown.includes("10:00 - 11:30"), shown);

  // Still there after reloading the page
  await page.reload();
  await page.getByText(title).first().waitFor({ timeout: 10000 }).catch(() => undefined);
  check("the event is still shown after reloading", (await page.innerText("body")).includes(title));

  // Editing it
  const renamed = `${title} (moved)`;
  await page.getByRole("button", { name: "Edit" }).click();
  await page.waitForURL(/\/edit$/);
  await page.locator("input[name=title]").fill(renamed);
  await app.typeDate(dates.nth(0), `${day(3)} 09:00`);
  await app.typeDate(dates.nth(1), `${day(3)} 09:45`);
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/edit"));
  await app.synced();
  saved = await itemsWith("etebase.vevent", title);
  check("the edited event replaced the old one on the server", saved.length === 1 && saved[0].includes(`SUMMARY:${renamed}`), saved);
  check("with its new start", new RegExp(`DTSTART;TZID=[^:]+:${icalDay(3)}T090000`).test(saved[0] || ""), saved[0]);
  check("and its location is kept", (saved[0] || "").includes("LOCATION:Main street 1"), saved[0]);

  // An event added elsewhere shows up after syncing
  const remote = `Remote meeting ${unique()}`;
  await api.addItem("etebase.vevent", [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//e2e//EN", "BEGIN:VEVENT", `UID:e2e-${unique()}`,
    `SUMMARY:${remote}`, `DTSTART:${icalDay(1)}T120000Z`, `DTEND:${icalDay(1)}T130000Z`, "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n"));
  await page.getByRole("tab", { name: "Calendar" }).click();
  await app.sync();
  await page.getByRole("button", { name: "Agenda" }).click();
  check("an event added elsewhere is shown after syncing", await page.getByText(remote).isVisible());

  // Deleting the edited event
  await page.getByText(renamed).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await page.waitForURL(/\/pim\/events$/);
  await app.synced();
  saved = await itemsWith("etebase.vevent", title);
  check("the deleted event is gone from the server", saved.length === 0, saved);
  await page.getByRole("button", { name: "Agenda" }).click();
  check("and from the agenda", !(await page.getByText(renamed).isVisible()));

  check("no sync errors", (await app.syncErrors()) === "", await app.syncErrors());
  await app.close(check);
});
