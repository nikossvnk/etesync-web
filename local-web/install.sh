#!/usr/bin/env bash
# Installs the EteSync web app (contacts, calendars and tasks) as an app that runs on this computer
# only, built from the repository this script is in, or updates it when it's installed already (it's
# safe to run again). See README.md in this directory.
#
#   ./install.sh                                   # install, or update to what the repository has now
#   git pull && ./install.sh                       # update to the latest version
#   SERVER=https://etebase.example.com ./install.sh   # the server the login page uses by default
#   PORT=8092 ./install.sh                         # another port (default 8091)
#   BROWSER=chromium ./install.sh                  # the browser the shortcut opens (default: found automatically)
#   LOW_MEMORY=0 ./install.sh                      # without the flags that make Chromium-based browsers use less memory
#
# What it does:
#   1. Builds the app from this repository into ~/.local/share/etesync-web/site
#   2. Serves it on http://localhost:PORT with a systemd user service, etesync-web.service, which
#      starts when you log in (only reachable from this computer)
#   3. Adds "EteSync" to the applications menu, and a shortcut on the desktop
set -euo pipefail

PORT="${PORT:-8091}"
SERVER="${SERVER:-}"
BASE="${XDG_DATA_HOME:-$HOME/.local/share}/etesync-web"
SITE="$BASE/site"
URL="http://localhost:$PORT"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(cd "$SCRIPT_DIR/.." && pwd)"

step() { printf '\n==> %s\n' "$*"; }
need() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Missing $1. $2" >&2
        exit 1
    fi
}

need python3 "Install it, e.g. with: sudo dnf install python3"
need node "Install Node.js 20.19 or newer, e.g. with: sudo dnf install nodejs (or with nvm)"
need npm "It comes with Node.js"
need systemctl "This needs systemd"
if ! node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit((a > 20 || (a === 20 && b >= 19)) ? 0 : 1)'; then
    echo "Node.js $(node --version) is too old, version 20.19 or newer is needed" >&2
    exit 1
fi

if [ "$(node -p "require('$SRC/package.json').name" 2>/dev/null)" != "etesync-web" ]; then
    echo "$SRC is not the etesync-web repository, this script has to stay in its local-web directory" >&2
    exit 1
fi
if [ -n "$SERVER" ] && [[ "$SERVER" != https://* ]]; then
    echo "SERVER has to start with https://" >&2
    exit 1
fi

step "Building $SRC"
mkdir -p "$BASE"
if command -v git >/dev/null 2>&1 && [ -d "$SRC/.git" ]; then
    echo "At $(git -C "$SRC" log -1 --format='%h %s')"
    if [ -n "$(git -C "$SRC" status --porcelain --untracked-files=no)" ]; then
        echo "Note: the repository has uncommitted changes, they are part of the build"
    fi
fi
# The default server is kept from the last install, unless another one is given
if [ -z "$SERVER" ] && [ -f "$BASE/server" ]; then
    SERVER="$(cat "$BASE/server")"
fi
if [ -n "$SERVER" ]; then
    SERVER="${SERVER%/}/"
    echo "The login page uses $SERVER by default"
fi
(
    cd "$SRC"
    # The packages are only installed when they aren't there, and then removed again after the build
    # (a few hundred MB that are only needed to build). Existing ones, e.g. of a checkout that's used
    # for development, are used as they are.
    installed_here=""
    if [ ! -d node_modules ]; then
        echo "Installing the packages needed to build (this takes a minute or two)"
        npm ci --no-audit --no-fund --loglevel=error
        installed_here=1
    fi
    rm -rf "$BASE/site.new"
    status=0
    if [ -n "$SERVER" ]; then
        export REACT_APP_DEFAULT_API_PATH="$SERVER"
    fi
    npx vite build --outDir "$BASE/site.new" --emptyOutDir > "$BASE/build.log" 2>&1 || status=$?
    [ -n "$installed_here" ] && rm -rf node_modules
    if [ "$status" -ne 0 ]; then
        echo "The build failed, see $BASE/build.log" >&2
        exit 1
    fi
)
# The source maps are only of use for development
find "$BASE/site.new" -name '*.map' -delete
rm -rf "$BASE/site.old"
[ -d "$SITE" ] && mv "$SITE" "$BASE/site.old"
mv "$BASE/site.new" "$SITE"
rm -rf "$BASE/site.old"
if [ -n "$SERVER" ]; then
    echo "$SERVER" > "$BASE/server"
fi

step "Installing the service (etesync-web.service on $URL)"
cp "$SCRIPT_DIR/serve.py" "$BASE/serve.py"
cp "$SRC/src/images/logo.svg" "$BASE/icon.svg"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/etesync-web.service" <<UNIT
[Unit]
Description=EteSync web app, served on $URL (this computer only)

[Service]
ExecStart=$(command -v python3) $BASE/serve.py --port $PORT --dir $SITE
Restart=on-failure

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --quiet etesync-web.service
systemctl --user restart etesync-web.service
for _ in $(seq 1 20); do
    curl -fsS -o /dev/null "$URL/" 2>/dev/null && break
    sleep 0.5
done
curl -fsS -o /dev/null "$URL/" || { echo "The service doesn't answer on $URL, see: journalctl --user -u etesync-web" >&2; exit 1; }

step "Adding the shortcut"
# A browser that can open it in its own window (an "app" window, without tabs and address bar)
browser="${BROWSER:-}"
if [ -z "$browser" ]; then
    for b in chromium-browser chromium google-chrome-stable google-chrome brave-browser microsoft-edge firefox; do
        if command -v "$b" >/dev/null 2>&1; then
            browser="$b"
            break
        fi
    done
fi
# Chromium-based browsers run the window in a browser of its own, so these leave out what it doesn't
# need: a spare page process kept ready, more than the window's two (the app and the window's frame),
# and background downloads, updates, sync, translation, casting and the back/forward cache. They keep
# the profile, so the app's data stays.
low_memory_flags=""
if [ "${LOW_MEMORY:-1}" != "0" ]; then
    low_memory_flags=" --renderer-process-limit=2 --disable-background-networking --disable-component-update --disable-sync --disable-default-apps --disable-features=SpareRendererForSitePerProcess,Translate,OptimizationHints,MediaRouter,BackForwardCache"
fi
case "$(basename "${browser:-xdg-open}")" in
    chromium*|google-chrome*|brave*|microsoft-edge*) exec_line="$browser$low_memory_flags --app=$URL" ;;
    firefox*) exec_line="$browser --new-window $URL" ;;
    *) exec_line="xdg-open $URL" ;;
esac
mkdir -p "$APPS_DIR"
desktop_file="$APPS_DIR/etesync-web.desktop"
cat > "$desktop_file" <<DESKTOP
[Desktop Entry]
Type=Application
Name=EteSync
Comment=End-to-end encrypted contacts, calendars and tasks (runs on this computer, $URL)
Exec=$exec_line
Icon=$BASE/icon.svg
Categories=Office;Calendar;ContactManagement;
StartupNotify=true
DESKTOP
chmod +x "$desktop_file"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database --quiet "$APPS_DIR" || true
desktop_dir="$(command -v xdg-user-dir >/dev/null 2>&1 && xdg-user-dir DESKTOP || echo "$HOME/Desktop")"
if [ -d "$desktop_dir" ]; then
    cp "$desktop_file" "$desktop_dir/etesync-web.desktop"
    chmod +x "$desktop_dir/etesync-web.desktop"
    # GNOME only starts desktop shortcuts that are marked as trusted
    command -v gio >/dev/null 2>&1 && gio set "$desktop_dir/etesync-web.desktop" metadata::trusted true 2>/dev/null || true
fi

step "Done"
echo "EteSync runs on $URL. Open it from the applications menu or the desktop (it opens with: $exec_line)."
echo "To update it later: git pull, then run this script again."
