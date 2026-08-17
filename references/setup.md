# Android SDK Setup Guide

## Headless Linux Server

### Prerequisites

```bash
# Java 17
sudo apt install openjdk-17-jdk

# KVM (required for x86_64 emulation)
sudo apt install qemu-kvm
sudo usermod -aG kvm $USER
# Log out and back in for group to take effect

# Verify KVM
egrep -c '(vmx|svm)' /proc/cpuinfo
# Should return > 0
```

### Install SDK

```bash
mkdir -p ~/Android/Sdk/cmdline-tools
cd /tmp
curl -fsSL -o cmdline-tools.zip \
  "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
unzip -qo cmdline-tools.zip -d cmdline-tools-tmp
mv cmdline-tools-tmp/cmdline-tools ~/Android/Sdk/cmdline-tools/latest
rm -rf cmdline-tools.zip cmdline-tools-tmp

# Environment (add to ~/.bashrc)
export ANDROID_HOME=~/Android/Sdk
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

### Accept licenses and install components

```bash
yes | sdkmanager --licenses
sdkmanager "platform-tools" "emulator" "platforms;android-34" \
  "system-images;android-34;google_apis;x86_64"
```

### Create AVD

```bash
echo "no" | avdmanager create avd \
  -n hermes-test \
  -k "system-images;android-34;google_apis;x86_64" \
  -d "pixel_6" \
  --force
```

### Start headless

```bash
emulator -avd hermes-test \
  -no-window \
  -no-audio \
  -no-boot-anim \
  -gpu swiftshader_indirect \
  -memory 2048 \
  -partition-size 4096 \
  -no-snapshot
```

### Verify

```bash
adb devices
# Should show: emulator-5554   device

adb shell getprop sys.boot_completed
# Should return: 1
```

## API Levels

| API | Android | Image | Notes |
|-----|---------|-------|-------|
| 34 | 14 | `google_apis;x86_64` | Recommended — stable, widely compatible |
| 35 | 15 | `google_apis;x86_64` | Latest — may have emulator quirks |
| 33 | 13 | `google_apis;x86_64` | Older — good for compatibility testing |

## Emulator Flags

| Flag | Purpose |
|------|---------|
| `-no-window` | Headless — no GUI needed |
| `-no-audio` | Disable sound |
| `-no-boot-anim` | Faster boot |
| `-gpu swiftshader_indirect` | Software rendering (works without GPU) |
| `-memory 2048` | 2GB RAM (default 1.5GB) |
| `-partition-size 4096` | 4GB system partition |
| `-no-snapshot` | No save state (clean boot each time) |
| `-no-snapshot-save` | Don't save state on exit |
| `-wipe-data` | Factory reset on start |

## Troubleshooting

### "Emulator killed by signal 9"
Out of memory. Reduce `-memory` or add swap.

### "WARNING: unexpected system image feature string"
System image version mismatch. Reinstall: `sdkmanager --install "system-images;android-34;google_apis;x86_64"`

### "Could not load OpenGLES emulation"
Use `-gpu swiftshader_indirect` instead of `host` or `auto`.

### Slow boot
First boot takes 60-90s. Subsequent boots are faster with snapshots (remove `-no-snapshot`).
