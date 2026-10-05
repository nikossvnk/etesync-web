// Builds the app for the test server, serves it and runs all of the tests in tests/ (or the ones
// given), one after the other, and sums up. E2E_NO_BUILD=1 uses the build from the last run.
const { spawn, spawnSync } = require("child_process");
const fs = require("fs"), http = require("http"), path = require("path");
const { config } = require("./lib");

const buildDir = path.join(__dirname, "build");

function build() {
  console.log(`Building the app for ${config.serverUrl}`);
  const r = spawnSync("npx", ["vite", "build", "--outDir", buildDir, "--emptyOutDir", "--logLevel", "warn"], {
    cwd: path.join(__dirname, ".."),
    // The tests log in to the test server, which is the default one of this build
    env: { ...process.env, REACT_APP_DEFAULT_API_PATH: config.serverUrl.replace(/\/*$/, "/") },
    stdio: "inherit",
  });
  if (r.status !== 0) {
    process.exit(1);
  }
}

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon", ".wasm": "application/wasm" };

// Serves the build, with index.html for the paths of the app
function serve() {
  const port = Number(new URL(config.appUrl).port);
  const server = http.createServer((req, res) => {
    const file = path.join(buildDir, path.normalize(decodeURIComponent(req.url.split("?")[0])));
    const found = file.startsWith(buildDir) && fs.existsSync(file) && fs.statSync(file).isFile();
    const served = found ? file : path.join(buildDir, "index.html");
    res.writeHead(200, { "Content-Type": types[path.extname(served)] || "application/octet-stream" });
    fs.createReadStream(served).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

function runTest(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { stdio: "inherit", cwd: __dirname });
    child.on("exit", (code) => resolve(code === 0));
  });
}

(async () => {
  if (!process.env.E2E_NO_BUILD || !fs.existsSync(buildDir)) {
    build();
  }
  const server = await serve();
  const dir = path.join(__dirname, "tests");
  const args = process.argv.slice(2);
  const tests = args.length ? args.map((x) => path.basename(x)) : fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
  const results = [];
  for (const t of tests) {
    console.log(`\n=== ${t}`);
    results.push([t, await runTest(path.join(dir, t))]);
  }
  server.close();
  console.log("\n=== Summary");
  for (const [t, ok] of results) {
    console.log(`${ok ? "pass" : "FAIL"}  ${t}`);
  }
  process.exit(results.every(([, ok]) => ok) ? 0 : 1);
})();
