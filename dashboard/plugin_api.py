"""Android Emulator dashboard API — live view + control.

Uses FastAPI APIRouter. Routes mount at /api/plugins/android-emulator/<path>.
Always returns valid JSON — never throws to the frontend.
"""

from __future__ import annotations

import base64
import os
import subprocess
import time

try:
    from fastapi import APIRouter
    from fastapi.responses import Response
    router = APIRouter()
except Exception:
    router = None

ADB = os.path.expanduser("~/Android/Sdk/platform-tools/adb")
_EMU_SERIAL = os.environ.get("ANDROID_EMULATOR_SERIAL", "emulator-5554")

_cache: dict = {"ts": 0.0, "data": None}
CACHE_TTL = 1.0


def _run(cmd: list[str], timeout: int = 10) -> tuple[bytes, int]:
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=timeout)
        return r.stdout, r.returncode
    except subprocess.TimeoutExpired:
        return b"", -1
    except Exception:
        return b"", -1


def _adb_text(*args: str, timeout: int = 10) -> tuple[str, int]:
    out, rc = _run([ADB, "-s", _EMU_SERIAL, *args], timeout=timeout)
    return out.decode("utf-8", errors="replace").strip(), rc


def _device_online() -> bool:
    """Check if emulator-5554 is in adb devices list."""
    out, _ = _run([ADB, "devices"], timeout=5)
    text = out.decode("utf-8", errors="replace")
    return "emulator-5554" in text and "device" in text.split("emulator-5554", 1)[-1].split("\n", 1)[0]


if router is not None:

    @router.get("/status")
    async def emu_status():
        try:
            online = _device_online()
            info: dict = {"online": online}
            if online:
                for key, args in [
                    ("android_version", ["shell", "getprop", "ro.build.version.release"]),
                    ("sdk", ["shell", "getprop", "ro.build.version.sdk"]),
                    ("model", ["shell", "getprop", "ro.product.model"]),
                    ("boot_completed", ["shell", "getprop", "sys.boot_completed"]),
                ]:
                    val, _ = _adb_text(*args)
                    info[key] = val
                size, _ = _adb_text("shell", "wm", "size")
                density, _ = _adb_text("shell", "wm", "density")
                info["screen_size"] = size.replace("Physical size: ", "")
                info["screen_density"] = density.replace("Physical density: ", "")
            return info
        except Exception as e:
            return {"online": False, "error": str(e)}

    @router.get("/screenshot")
    async def emu_screenshot():
        """Raw PNG screenshot."""
        try:
            now = time.time()
            if _cache["data"] and (now - _cache["ts"]) < CACHE_TTL:
                return Response(content=_cache["data"], media_type="image/png")

            if not _device_online():
                return Response(content=b"", status_code=204)

            out, rc = _run([ADB, "-s", _EMU_SERIAL, "exec-out", "screencap", "-p"], timeout=5)
            if rc != 0 or len(out) < 100:
                return Response(content=b"", status_code=204)

            _cache["ts"] = now
            _cache["data"] = out
            return Response(content=out, media_type="image/png")
        except Exception:
            return Response(content=b"", status_code=204)

    @router.get("/screenshot_b64")
    async def emu_screenshot_b64():
        """Screenshot as base64 data URL."""
        try:
            if not _device_online():
                return {"image": None, "error": "offline"}

            out, rc = _run([ADB, "-s", _EMU_SERIAL, "exec-out", "screencap", "-p"], timeout=5)
            if rc != 0 or len(out) < 100:
                return {"image": None, "error": "screencap failed"}

            b64 = base64.b64encode(out).decode("ascii")
            return {"image": f"data:image/png;base64,{b64}", "bytes": len(out)}
        except Exception as e:
            return {"image": None, "error": str(e)}

    @router.get("/input/tap/{x}/{y}")
    async def emu_tap(x: int, y: int):
        _adb_text("shell", "input", "tap", str(x), str(y))
        return {"ok": True}

    @router.get("/input/key/{keycode}")
    async def emu_key(keycode: str):
        if not keycode.startswith("KEYCODE_"):
            keycode = f"KEYCODE_{keycode}"
        _adb_text("shell", "input", "keyevent", keycode)
        return {"ok": True}

    @router.get("/logcat")
    async def emu_logcat(lines: int = 80):
        out, _ = _adb_text("shell", "logcat", "-d", "-t", str(lines))
        return {"lines": out.splitlines()[-lines:]}

    # ── Batch 1: App drawer, text input, swipes, screenshots ──────────

    SCREENSHOT_DIR = os.path.expanduser("~/.hermes/emulator-screenshots")

    @router.get("/apps")
    async def list_apps(filter: str = ""):
        """List installed packages with labels. Filter by keyword."""
        cmd = ["shell", "pm", "list", "packages", "-3"]  # third-party only by default
        if filter:
            cmd.append(filter)
        out, _ = _adb_text(*cmd)
        packages = [
            line.replace("package:", "").strip()
            for line in out.splitlines()
            if line.startswith("package:")
        ]
        # Get app labels via dumpsys
        apps = []
        for pkg in packages[:50]:  # cap at50
            label_out, _ = _adb_text(
                "shell", "dumpsys", "package", pkg,
            )
            # Extract label from the dump
            label = pkg.split(".")[-1].capitalize()
            for line in label_out.splitlines():
                if "label=" in line:
                    label = line.split("label=")[1].strip()
                    break
            apps.append({"package": pkg, "label": label})
        return {"apps": apps, "count": len(apps)}

    @router.post("/apps/launch")
    async def launch_app(package: str):
        """Launch an app by package name."""
        out, rc = _adb_text(
            "shell", "monkey", "-p", package,
            "-c", "android.intent.category.LAUNCHER", "1",
        )
        return {"ok": rc == 0, "output": out}

    @router.post("/apps/uninstall")
    async def uninstall_app(package: str):
        """Uninstall an app by package name."""
        out, rc = _adb_text("uninstall", package)
        return {"ok": rc == 0, "output": out}

    @router.post("/type")
    async def type_text(text: str):
        """Type text into the focused field. Use %s for spaces."""
        _adb_text("shell", "input", "text", text)
        return {"ok": True}

    @router.post("/swipe/{direction}")
    async def swipe(direction: str, distance: int = 500):
        """Swipe in a direction: up, down, left, right."""
        cx, cy = 540, 1200  # center of screen
        moves = {
            "up": (cx, cy + distance // 2, cx, cy - distance // 2),
            "down": (cx, cy - distance // 2, cx, cy + distance // 2),
            "left": (cx + distance // 2, cy, cx - distance // 2, cy),
            "right": (cx - distance // 2, cy, cx + distance // 2, cy),
        }
        if direction not in moves:
            return {"ok": False, "error": f"Unknown direction: {direction}"}
        x1, y1, x2, y2 = moves[direction]
        _adb_text("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), "300")
        return {"ok": True, "direction": direction}

    @router.post("/pinch/{action}")
    async def pinch(action: str):
        """Pinch in or out (zoom). Uses two-finger swipe."""
        cx, cy = 540, 1200
        if action == "in":
            # Two fingers move toward center
            _adb_text("shell", "input", "swipe", "340", "1000", "440", "1100", "500")
            _adb_text("shell", "input", "swipe", "740", "1400", "640", "1300", "500")
        elif action == "out":
            # Two fingers move away from center
            _adb_text("shell", "input", "swipe", "440", "1100", "340", "1000", "500")
            _adb_text("shell", "input", "swipe", "640", "1300", "740", "1400", "500")
        else:
            return {"ok": False, "error": f"Unknown action: {action}"}
        return {"ok": True, "action": action}

    @router.post("/screenshot/save")
    async def save_screenshot(label: str = ""):
        """Save current screenshot to gallery."""
        os.makedirs(SCREENSHOT_DIR, exist_ok=True)
        ts = int(time.time())
        name = f"{ts}_{label}.png" if label else f"{ts}.png"
        path = os.path.join(SCREENSHOT_DIR, name)
        out, rc = _run([ADB, "-s", _EMU_SERIAL, "exec-out", "screencap", "-p"], timeout=5)
        if rc != 0 or len(out) < 100:
            return {"ok": False, "error": "screencap failed"}
        with open(path, "wb") as f:
            f.write(out)
        return {"ok": True, "path": path, "size": len(out)}

    @router.get("/screenshot/gallery")
    async def screenshot_gallery(limit: int = 20):
        """List saved screenshots."""
        if not os.path.isdir(SCREENSHOT_DIR):
            return {"screenshots": [], "count": 0}
        files = sorted(os.listdir(SCREENSHOT_DIR), reverse=True)[:limit]
        screenshots = []
        for f in files:
            if f.endswith(".png"):
                path = os.path.join(SCREENSHOT_DIR, f)
                screenshots.append({
                    "name": f,
                    "path": path,
                    "size": os.path.getsize(path),
                    "time": os.path.getmtime(path),
                })
        return {"screenshots": screenshots, "count": len(screenshots)}

    @router.get("/screenshot/file/{filename}")
    async def screenshot_file(filename: str):
        """Serve a saved screenshot."""
        from fastapi.responses import Response
        path = os.path.join(SCREENSHOT_DIR, filename)
        if not os.path.isfile(path):
            return Response(content=b"", status_code=404)
        with open(path, "rb") as f:
            data = f.read()
        return Response(content=data, media_type="image/png")

    @router.post("/network/{condition}")
    async def network_condition(condition: str):
        """Simulate network: offline, slow, fast."""
        if condition == "offline":
            _adb_text("shell", "svc", "wifi", "disable")
            _adb_text("shell", "svc", "data", "disable")
        elif condition == "slow":
            _adb_text("shell", "svc", "wifi", "enable")
            _adb_text("shell", "svc", "data", "enable")
            # Use tc for traffic shaping (requires root, emulator has it)
            _adb_text("shell", "tc", "qdisc", "add", "dev", "wlan0", "root", "netem", "delay", "500ms", "loss", "10%")
        elif condition == "fast":
            _adb_text("shell", "tc", "qdisc", "del", "dev", "wlan0", "root")
            _adb_text("shell", "svc", "wifi", "enable")
            _adb_text("shell", "svc", "data", "enable")
        else:
            return {"ok": False, "error": f"Unknown condition: {condition}"}
        return {"ok": True, "condition": condition}

    @router.post("/record/start")
    async def start_recording():
        """Start screen recording (max3 min)."""
        _adb_text("shell", "screenrecord", "--time-limit", "180", "/sdcard/hermes_recording.mp4")
        return {"ok": True, "message": "Recording started (max3 min)"}

    @router.post("/record/stop")
    async def stop_recording():
        """Stop screen recording and pull the file."""
        _adb_text("shell", "pkill", "-INT", "screenrecord")
        import time
        time.sleep(2)
        os.makedirs(SCREENSHOT_DIR, exist_ok=True)
        ts = int(time.time())
        local_path = os.path.join(SCREENSHOT_DIR, f"recording_{ts}.mp4")
        _adb_text("pull", "/sdcard/hermes_recording.mp4", local_path)
        return {"ok": True, "path": local_path}

    @router.post("/shell")
    async def run_shell(command: str):
        """Run an arbitrary adb shell command."""
        out, rc = _adb_text("shell", "sh", "-c", command, timeout=30)
        return {"stdout": out, "exit_code": rc}

    # ── AVD picker endpoints ───────────────────────────────────────────

    AVDMANAGER = os.path.expanduser(
        "~/Android/Sdk/cmdline-tools/latest/bin/avdmanager"
    )
    SDKMANAGER = os.path.expanduser(
        "~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager"
    )

    @router.get("/picker")
    async def picker_data():
        """All data the picker needs in one call: AVDs, devices, images."""
        import re

        # 1. Installed AVDs
        out, _ = _run([AVDMANAGER, "list", "avd"], timeout=10)
        text = out.decode("utf-8", errors="replace")
        avds = []
        current: dict = {}
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("Name:"):
                if current:
                    avds.append(current)
                current = {"name": line.split(":", 1)[1].strip()}
            elif line.startswith("Device:"):
                current["device"] = line.split(":", 1)[1].strip()
            elif line.startswith("Target:"):
                current["target"] = line.split(":", 1)[1].strip()
            elif line.startswith("Path:"):
                current["path"] = line.split(":", 1)[1].strip()
            elif "Based on:" in line:
                current["based_on"] = line.split("Based on:", 1)[1].strip()
        if current:
            avds.append(current)

        # 2. Available device profiles
        out, _ = _run([AVDMANAGER, "list", "device"], timeout=10)
        text = out.decode("utf-8", errors="replace")
        devices = []
        current = {}
        for line in text.splitlines():
            line = line.strip()
            m = re.match(r'id:\s+\d+\s+or\s+"([^"]+)"', line)
            if m:
                if current:
                    devices.append(current)
                current = {"id": m.group(1)}
            elif line.startswith("Name:"):
                current["name"] = line.split(":", 1)[1].strip()
            elif line.startswith("Size:"):
                current["size"] = line.split(":", 1)[1].strip()
            elif line.startswith("Resolution:"):
                current["resolution"] = line.split(":", 1)[1].strip()
            elif line.startswith("Density:"):
                current["density"] = line.split(":", 1)[1].strip()
        if current:
            devices.append(current)

        # 3. Installed system images
        out, _ = _run([SDKMANAGER, "--list_installed"], timeout=15)
        text = out.decode("utf-8", errors="replace")
        installed_images = []
        for line in text.splitlines():
            if "system-images" in line and "|" in line:
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 3:
                    pkg = parts[0]
                    api_match = re.search(r"android-(\d+)", pkg)
                    api = api_match.group(1) if api_match else parts[1]
                    installed_images.append({
                        "package": pkg,
                        "api": api,
                        "description": parts[2],
                    })

        # 4. Available (not installed) system images
        out, _ = _run([SDKMANAGER, "--list"], timeout=30)
        text = out.decode("utf-8", errors="replace")
        available_images = []
        installed_pkgs = {i["package"] for i in installed_images}
        for line in text.splitlines():
            if "system-images" in line and "google_apis" in line and "x86_64" in line and "|" in line:
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 3:
                    pkg = parts[0]
                    if pkg not in installed_pkgs:
                        api_match = re.search(r"android-(\d+)", pkg)
                        api = api_match.group(1) if api_match else parts[1]
                        available_images.append({
                            "package": pkg,
                            "api": api,
                            "description": parts[2],
                        })

        return {
            "avds": avds,
            "devices": devices,
            "installed_images": installed_images,
            "available_images": available_images,
            "active_avd": "hermes-test",
        }

    @router.post("/create")
    async def create_avd(
        name: str = "custom",
        device: str = "pixel_6",
        api: str = "34",
    ):
        """Create a new AVD. Installs system image if needed."""
        img_pkg = f"system-images;android-{api};google_apis;x86_64"
        # Check if image is installed, install if not
        out, _ = _run([SDKMANAGER, "--list_installed"], timeout=10)
        if img_pkg.encode() not in out:
            # Install the image first
            out, rc = _run(
                [SDKMANAGER, img_pkg],
                timeout=300,
            )
            if rc != 0:
                return {
                    "ok": False,
                    "error": f"Failed to install {img_pkg}",
                    "output": out.decode("utf-8", errors="replace"),
                }
        # Create the AVD
        out, rc = _run(
            [AVDMANAGER, "create", "avd", "-n", name, "-k", img_pkg, "-d", device, "--force"],
            timeout=30,
        )
        return {
            "ok": rc == 0,
            "output": out.decode("utf-8", errors="replace"),
            "avd": name,
        }
