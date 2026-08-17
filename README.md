# Android Emulator for Hermes Agent

Control a headless Android emulator from Hermes — install APKs, take screenshots, tap/swipe/type, manage apps, simulate device conditions, and view a live screen in the desktop sidebar.

## Features

### Core Emulator Control
- **Live sidebar panel** — real-time emulator view with tap-to-interact
- **Start/Stop** — boot and shut down emulator from the sidebar
- **Navigation** — Back, Home, Recent Apps, Power buttons
- **Swipe gestures** — Up, Down, Left, Right directional swipes
- **Text input** — Type text directly into the emulator
- **Screenshot** — Capture and save to local gallery

### App Management
- **App drawer** — Browse all installed apps (user apps first, then system)
- **Launch apps** — Tap to launch any installed app
- **Install/Uninstall** — Manage APKs via the sidebar

### Device Simulation
- **GPS location** — Set lat/lng coordinates for location testing
- **Battery simulation** — Set charge level (0-100%), simulate unplugged
- **Network conditions** — Toggle offline, slow (500ms+10% loss), or fast
- **Deep links** — Open URL schemes directly
- **Push notifications** — Send test notifications

### Developer Tools
- **ADB shell** — Run arbitrary commands from the sidebar
- **Logcat viewer** — Real-time log output with filtering
- **Screen recording** — Start/stop recording, save as MP4
- **Record & replay** — Capture touch sequences and replay them
- **Test runner** — Run instrumented tests and view results
- **Screenshot gallery** — Browse saved screenshots

### AVD Management
- **Device picker** — Browse all available phone models
- **Android versions** — Install new API levels (21-35)
- **Create AVDs** — Create new virtual devices from the sidebar
- **Delete/Wipe** — Remove or factory reset AVDs

### CLI
- **`emu start`** — Boot the emulator headless
- **`emu stop`** — Shut down the emulator
- **`emu status`** — Check if running + device info

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
# Default: Pixel 7 Pro with Android 14
echo "no" | avdmanager create avd \
  -n pixel7pro \
  -k "system-images;android-34;google_apis;x86_64" \
  -d "pixel_7_pro" \
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

### Sidebar Controls

| Section | What it does |
|---------|-------------|
| **📱 Picker** | Device selector, AVDs, Android versions |
| **📱 Screen** | Live emulator view, tap to interact |
| **🔙🏠📋⏻** | Back, Home, Recent, Power buttons |
| **↖⬆⬇➡** | Swipe direction buttons |
| **⌨ Text input** | Type text directly into emulator |
| **📦 Apps** | Expandable app drawer, tap to launch |
| **📸🌐⏺💻** | Save screenshot, Network sim, Record, Shell |
| **⏸📜⏹** | Pause, Logcat, Stop emulator |
| **⚡ More Tools** | GPS, Battery, Deep links, Notifications, Recording, Test runner, Gallery |

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
"Set GPS to San Francisco"
"Set battery to 25%"
"Go offline"
"Open deep link myapp://path"
```

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `ANDROID_HOME` | `~/Android/Sdk` | SDK location |
| `ANDROID_EMULATOR_SERIAL` | `emulator-5554` | Target device serial |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Hermes Agent   │────▶│  plugin_api.py   │────▶│    ADB      │
│  (14 tools)     │     │  (35 endpoints)  │     │  emulator   │
└─────────────────┘     └──────────────────┘     └─────────────┘
                              ▲
┌─────────────────┐           │
│  Hermes Desktop │───────────┘
│  (plugin.js)    │
│  sidebar panel  │
└─────────────────┘
```

- `__init__.py` — Agent tools registered via `ctx.register_tool()`
- `dashboard/plugin_api.py` — FastAPI `APIRouter` with35 endpoints
- `dashboard/plugin.js` — ESM desktop plugin using `ctx.registerMany()` + `useQuery`
- `scripts/emu` — Bash wrapper for emulator lifecycle

## API Endpoints (35)

| Category | Endpoints |
|----------|-----------|
| Core | `status`, `screenshot`, `screenshot_b64`, `start`, `stop` |
| Input | `tap`, `swipe`, `type`, `key`, `shell` |
| Apps | `apps`, `apps/launch`, `apps/uninstall` |
| AVD | `picker`, `create`, `avd/delete`, `avd/wipe` |
| Media | `screenshot/save`, `screenshot/gallery`, `screenshot/file`, `record/start`, `record/stop` |
| Simulation | `gps`, `gps/clear`, `battery`, `battery/reset`, `battery/unplug`, `network` |
| Dev tools | `logcat`, `deeplink`, `notification`, `replay/record/start`, `replay/record/stop`, `replay/play`, `test/run`, `shortcuts` |

## Troubleshooting

**Emulator won't start:**
- Check `~/.android/avd/pixel7pro.avd` exists
- Verify KVM: `egrep -c '(vmx|svm)' /proc/cpuinfo` (should be > 0)
- Check logs: `cat /tmp/emulator.log`

**"Connection failed" in sidebar:**
- Ensure the emulator is running: `emu status`
- Click the **▶ Start Emulator** button in the sidebar
- Restart the dashboard: close and reopen Hermes Desktop

**Multiple devices connected:**
- The plugin targets `emulator-5554` by default
- Set `ANDROID_EMULATOR_SERIAL` to use a different device

**App list empty:**
- The emulator may have been wiped — reinstall your APKs
- Use the **▶ Start Emulator** button to boot a fresh instance

## License

MIT
