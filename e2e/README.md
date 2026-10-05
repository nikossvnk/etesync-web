# Browser tests

These tests use the EteSync web app in a headless Chromium, against an Etebase test server, the way a
person would: the first-run setup, adding, editing and deleting events, contacts (with groups) and
tasks, importing files, the settings and logging out. What the app saves is checked on the server
itself, through the Etebase client, not only on the page. Every check prints `ok` or `FAIL`, and a
test fails when any of its checks does, or when there are errors on the page.

They change the data of the test account (`01-wizard.js` deletes all of its collections), so never
point them at a real server or account.

## Running them

1. An Etebase test server that allows signing up, e.g. the `test-server` image of the Etebase server
   (`docker/test-server` in its repository), on `http://127.0.0.1:3735`:

   ```
   docker run -d --name etebase-test -p 127.0.0.1:3735:3735 etesync/test-server
   ```

2. The dependencies of the app (`npm ci` in the root of the repository) and of the tests:

   ```
   cd e2e
   npm install
   ```

3. A Chromium for Playwright: `npx playwright install chromium`, or set `E2E_CHROMIUM` to the path
   of a Chromium (or chrome-headless-shell) binary.

4. Create the test account (only needed once per server), then run the tests:

   ```
   node setup.js
   node run.js                    # all of them
   node run.js 03-contacts.js     # or some of them
   ```

`run.js` builds the app with the test server as its default server (into `e2e/build`), serves it on
`http://localhost:8766` and runs the tests one after the other. `E2E_NO_BUILD=1` skips the build and
uses the one from the last run. A full run takes about 2 minutes. When a test fails, a screenshot of
the page is saved as `failed-<test>.png`.

## Configuration

| Variable | Default | |
|---|---|---|
| `E2E_APP_URL` | `http://localhost:8766` | Where `run.js` serves the app |
| `E2E_SERVER` | `http://127.0.0.1:3735` | The Etebase test server |
| `E2E_USER`, `E2E_PASSWORD` | `web-tester`, `web-tester-password` | The test account, created by `setup.js` |
| `E2E_CHROMIUM` | Playwright's Chromium | The Chromium binary to use |

## Writing tests

The helpers are in `lib.js`. `open()` starts a browser with the app and collects the errors on the
page; `loginToPim()` logs in (and goes through the setup when the account has no collections). Tests
check the server's side with `itemsWith(type, text)`, which returns the content of the items that
include the text, and add items with `api.addItem()`. Dates are typed in the default format of the
app, DD/MM/YYYY (`day()`).
