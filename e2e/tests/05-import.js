// Importing events and contacts from files into a collection
const { check, icalDay, itemsWith, open, run, unique } = require("../lib");

// Opens the import of a collection, picks the file and returns what the dialog says afterwards
async function importFile(page, collection, file) {
  await page.goto(new URL("/collections", page.url()).toString());
  await page.getByText(collection, { exact: true }).click();
  await page.waitForURL(/\/collections\/[^/]+$/);
  await page.getByTitle("Import").click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("input[type=file]").setInputFiles(file);
  await dialog.getByText(/Imported \d+ items/).waitFor({ timeout: 15000 }).catch(() => undefined);
  const text = await dialog.innerText();
  await page.keyboard.press("Escape");
  return text;
}

run(async () => {
  const app = await open();
  const { page } = app;
  await app.loginToPim();
  const id = unique();

  // Two events, in a file like other calendar apps export
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//e2e//EN",
    "BEGIN:VEVENT", `UID:e2e-import-1-${id}`, `SUMMARY:Imported one ${id}`, `DTSTART:${icalDay(4)}T080000Z`, `DTEND:${icalDay(4)}T090000Z`, "END:VEVENT",
    "BEGIN:VEVENT", `UID:e2e-import-2-${id}`, `SUMMARY:Imported two ${id}`, `DTSTART;VALUE=DATE:${icalDay(6)}`, "END:VEVENT",
    "END:VCALENDAR", "",
  ].join("\r\n");
  let shown = await importFile(page, "My Calendar", { name: "export.ics", mimeType: "text/calendar", buffer: Buffer.from(ics) });
  check("the dialog says both events were imported", shown.includes("Imported 2 items"), shown);
  let saved = await itemsWith("etebase.vevent", `Imported`);
  check("the first event is on the server", saved.some((x) => x.includes(`SUMMARY:Imported one ${id}`)), saved.length);
  check("the second event is on the server", saved.some((x) => x.includes(`SUMMARY:Imported two ${id}`)), saved.length);
  await page.goto(new URL("/pim/events", page.url()).toString());
  await app.synced();
  await page.getByRole("button", { name: "Agenda" }).click();
  check("the imported events are in the calendar", await page.getByText(`Imported one ${id}`).isVisible() && await page.getByText(`Imported two ${id}`).isVisible());

  // Two contacts, from a file without a type, which is found by its extension
  const vcf = [
    "BEGIN:VCARD", "VERSION:3.0", `UID:e2e-import-a-${id}`, `FN:Ann Imported${id}`, `N:Imported${id};Ann;;;`, "TEL;TYPE=CELL:+30 690 0000001", "END:VCARD",
    "BEGIN:VCARD", "VERSION:3.0", `UID:e2e-import-b-${id}`, `FN:Bob Imported${id}`, `N:Imported${id};Bob;;;`, "EMAIL:bob@example.invalid", "END:VCARD", "",
  ].join("\r\n");
  shown = await importFile(page, "My Contacts", { name: "contacts.vcf", mimeType: "", buffer: Buffer.from(vcf) });
  check("the dialog says both contacts were imported", shown.includes("Imported 2 items"), shown);
  saved = await itemsWith("etebase.vcard", `Imported${id}`);
  check("both contacts are on the server", saved.length === 2, saved.length);
  await page.goto(new URL("/pim/contacts", page.url()).toString());
  await app.synced();
  check("the imported contacts are in the address book", await page.getByText(`Ann Imported${id}`).isVisible() && await page.getByText(`Bob Imported${id}`).isVisible());

  // A file that isn't a calendar isn't imported
  let alerted = "";
  page.once("dialog", (d) => {
    alerted = d.message();
    d.accept();
  });
  shown = await importFile(page, "My Calendar", { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Not a calendar") });
  check("a file of another type is refused", alerted.includes("Is the file type supported?") && !shown.includes("Imported"), [alerted, shown]);

  check("no sync errors", (await app.syncErrors()) === "", await app.syncErrors());
  await app.close(check);
});
