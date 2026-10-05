// Address book: adding contacts, with groups, showing, searching, editing and deleting them
const { check, itemsWith, open, run, unique } = require("../lib");

run(async () => {
  const app = await open();
  const { page } = app;
  await app.loginToPim();
  await page.getByRole("tab", { name: "Address Book" }).click();
  await page.waitForURL(/\/pim\/contacts$/);

  // A new contact, in a new group
  const id = unique();
  const last = `Doe${id}`;
  const group = `Family ${id}`;
  await page.locator("button[class*=Fab]").click();
  await page.waitForURL(/\/contacts\/new/);
  await page.locator("input[name=firstName]").fill("Jane");
  await page.locator("input[name=lastName]").fill(last);
  await page.getByPlaceholder("Phone").fill("+30 210 1234567");
  await page.getByPlaceholder("Email").fill("jane@example.invalid");
  await page.locator("input[name=org]").fill("Acme");
  await page.locator("textarea[name=note]").fill("Met at the conference");
  const groups = page.getByRole("textbox", { name: "Groups" });
  await groups.fill(group);
  await groups.press("Enter");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/pim\/contacts(\/[^/]+)?$/);
  await app.synced();

  let saved = await itemsWith("etebase.vcard", last);
  check("the contact is on the server", saved.length === 1, saved.length);
  const vcard = saved[0] || "";
  check("with its name", vcard.includes(`FN:Jane ${last}`) && vcard.includes(`N:${last};Jane;`), vcard);
  check("with its phone", /^TEL[^:]*:\+30 210 1234567/m.test(vcard), vcard);
  check("with its email", /^EMAIL[^:]*:jane@example.invalid/m.test(vcard), vcard);
  check("with its organization", vcard.includes("ORG:Acme"), vcard);
  check("with its note", vcard.includes("NOTE:Met at the conference"), vcard);
  check("without the IM address that was left empty", !/^IMPP/m.test(vcard), vcard);
  const uid = (/^UID:(.*)$/m.exec(vcard) || [])[1]?.trim();
  let groupCards = await itemsWith("etebase.vcard", `FN:${group}`);
  check("the new group is on the server", groupCards.length === 1, groupCards);
  check("with the contact in it", !!uid && (groupCards[0] || "").includes(`MEMBER:urn:uuid:${uid}`), groupCards[0]);

  // Shown in the address book, and on its own page
  await page.goto(new URL("/pim/contacts", page.url()).toString());
  await app.synced();
  check("the contact is in the address book", await page.getByText(`Jane ${last}`).isVisible());
  await page.getByText(`Jane ${last}`).click();
  await page.waitForURL(/\/pim\/contacts\/[^/]+$/);
  const shown = await page.innerText("body");
  for (const [what, text] of [["name", `Jane ${last}`], ["phone", "+30 210 1234567"], ["email", "jane@example.invalid"], ["note", "Met at the conference"]]) {
    check(`the contact page shows the ${what}`, shown.includes(text), shown);
  }

  // Searching
  await page.goto(new URL("/pim/contacts", page.url()).toString());
  await page.getByPlaceholder("Search").fill(last);
  check("searching finds the contact", await page.getByText(`Jane ${last}`).isVisible());
  await page.getByPlaceholder("Search").fill(`nobody${id}`);
  check("searching for something else doesn't show it", !(await page.getByText(`Jane ${last}`).isVisible()));
  await page.getByPlaceholder("Search").fill("");

  // Editing it: a new email and an IM address, and out of the group
  await page.getByText(`Jane ${last}`).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.waitForURL(/\/edit/);
  await page.getByPlaceholder("Email").fill("jane.doe@example.invalid");
  await page.getByTitle("Add impp address").click();
  await page.getByPlaceholder("IMPP").fill("jane@im.example.invalid");
  await page.getByRole("button", { name: group }).locator("svg").click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/edit"));
  await app.synced();
  saved = await itemsWith("etebase.vcard", `FN:Jane ${last}`);
  check("the edited contact replaced the old one on the server", saved.length === 1 && saved[0].includes("jane.doe@example.invalid") && !saved[0].includes("jane@example.invalid"), saved);
  groupCards = await itemsWith("etebase.vcard", `FN:${group}`);
  check("with the IM address", /^IMPP[^:]*:jabber:jane@im.example.invalid\r?$/m.test(saved[0] || ""), saved[0]);
  check("the contact was taken out of the group", groupCards.length === 1 && !groupCards[0].includes(`MEMBER:urn:uuid:${uid}`), groupCards);

  // Editing it again keeps what wasn't changed as it was
  const before = saved[0] || "";
  await page.getByRole("button", { name: "Edit" }).click();
  await page.waitForURL(/\/edit/);
  check("the IM address is shown as it was entered", (await page.getByPlaceholder("IMPP").inputValue()) === "jane@im.example.invalid", await page.getByPlaceholder("IMPP").inputValue());
  await page.locator("textarea[name=note]").fill("Met at the conference in Athens");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/edit"));
  await app.synced();
  saved = await itemsWith("etebase.vcard", `FN:Jane ${last}`);
  const unchanged = (x) => x.split(/\r?\n/).filter((line) => !/^(NOTE|REV)/.test(line)).join("\n");
  check("a second edit changes only the note", saved.length === 1 && saved[0].includes("NOTE:Met at the conference in Athens") && unchanged(saved[0]) === unchanged(before), [before, saved[0]]);

  // Deleting it
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await page.waitForURL(/\/pim\/contacts$/);
  await app.synced();
  saved = await itemsWith("etebase.vcard", `FN:Jane ${last}`);
  check("the deleted contact is gone from the server", saved.length === 0, saved);
  check("and from the address book", !(await page.getByText(`Jane ${last}`).isVisible()));

  check("no sync errors", (await app.syncErrors()) === "", await app.syncErrors());
  await app.close(check);
});
