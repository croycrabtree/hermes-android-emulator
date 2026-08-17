# Android Emulator for Hermes Agent

Control a headless Android emulator from Hermes — install APKs, take screenshots, tap/swipe/type, manage apps, and view a live screen in the desktop sidebar.

## Features

- **14 agent tools** — `emu_status`, `emu_shell`, `emu_install`, `emu_uninstall`, `emu_screenshot`, `emu_tap`, `emu_swipe`, `emu_type`, `emu_key`, `emu_launch`, `emu_packages`, `emu_push`, `emu_pull`, `emu_logcat`
- **Live sidebar panel** — real-time emulator view in Hermes Desktop with tap-to-interact, navigation buttons, and logcat viewer
- **CLI wrapper** — `emu start | stop | status`
- **Works headless** — no display needed (swiftshader software rendering)

## Prerequisites

- Linux x86_64 (tested on Ubuntu 24.04)
- Java 17+
- ~6GB disk for SDK + system image
- ~2GB RAM for the emulator

## Install

### 1. Install Android SDK

```bash
# Download command-line tools
mkdir -p ~/Android/Sdk/cmdline-tools
curl -fsSL -o /tmp/cmdline-tools.zip \
  "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
unzip -qo /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-tmp
mv /tmp/cmdline-tools-tmp/cmdline-tools ~/Android/Sdk/cmdline-tools/latest
rm -rf /tmp/cmdline-tools.zip /tmp/cmdline-tools-tmp

# Add to PATH (add to ~/.bashrc)
export ANDROID_HOME=~/Android/Sdk
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

# Accept licenses and install components
yes | sdkmanager --licenses
sdkmanager "platform-tools" "emulator" "platforms;android-34" \
  "system-images;android-34;google_apis;x86_64"
```

### 2. Create AVD

```bash
echo "no" | avdmanager create avd \
  -n hermes-test \
  -k "system-images;android-34;google_apis;x86_64" \
  -d "pixel_6" \
  --force
```

### 3. Install the plugin

```bash
# Clone into Hermes plugins directory
git clone https://github.com/croycrabtree/hermes-android-emulator.git \
  ~/.hermes/plugins/android-emulator

# Enable the plugin
hermes plugins enable android-emulator

# Install the CLI wrapper
ln -sf ~/.hermes/plugins/android-emulator/scripts/emu /usr/local/bin/emu
```

### 4. Install the desktop sidebar (optional)

Copy `dashboard/plugin.js` to your Hermes Desktop plugins folder:

- **Windows:** `%LOCALAPPDATA%\hermes\desktop-plugins\android-emulator\plugin.js`
- **macOS:** `~/Library/Application Support/hermes/desktop-plugins/android-emulator/plugin.js`

The sidebar auto-reloads on file changes. Restart Hermes Desktop after first install.

## Usage

### CLI

```bash
emu start     # Boot emulator headless
emu stop      # Shut down
emu status    # Check if running + device info
```

### Agent tools

The tools are available in any Hermes session after enabling the plugin:

```
"Install the APK at /path/to/app.apk on the emulator"
"Take a screenshot of the emulator"
"Tap at coordinates 540, 1200"
"Launch com.example.app on the emulator"
"Show the last 50 lines of logcat"
```

### Desktop sidebar

Click **Emulator** in the Hermes Desktop sidebar to see a live view. Features:
- Auto-refreshing screenshot (every 3 seconds)
- Tap on the screenshot to interact
- Navigation buttons (Back, Home, Recent, Power)
- Pause/Resume live refresh
- Logcat viewer

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `ANDROID_HOME` | `~/Android/Sdk` | SDK location |
| `ANDROID_EMULATOR_SERIAL` | `emulator-5554` | Target device serial |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Hermes Agent   │────▶│  plugin_api.py   │────▶│    ADB      │
│  (14 tools)     │     │  (FastAPI routes) │     │  emulator   │
└─────────────────┘     └──────────────────┘     └─────────────┘
                              ▲
┌─────────────────┐           │
│  Hermes Desktop │───────────┘
│  (plugin.js)    │
│  sidebar panel  │
└─────────────────┘
```

- `__init__.py` — Agent tools registered via `ctx.register_tool()`
- `dashboard/plugin_api.py` — FastAPI `APIRouter` with screenshot/status/input endpoints
- `dashboard/plugin.js` — ESM desktop plugin using `ctx.registerMany()` + `useQuery`
- `scripts/emu` — Bash wrapper for emulator lifecycle

## Troubleshooting

**Emulator won't start:**
- Check `~/.android/avd/hermes-test.avd` exists
- Verify KVM: `egrep -c '(vmx|svm)' /proc/cpuinfo` (should be > 0)
- Check logs: `cat /tmp/emulator.log`

**"Connection failed" in sidebar:**
- Ensure the emulator is running: `emu status`
- Restart the dashboard: close and reopen Hermes Desktop

**Multiple devices connected:**
- The plugin targets `emulator-5554` by default
- Set `ANDROID_EMULATOR_SERIAL` to use a different device

## License

MIT
