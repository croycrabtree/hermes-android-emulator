"""Hermes plugin — control a headless Android emulator via ADB."""

import json
import os
import subprocess

ADB = os.path.expanduser("~/Android/Sdk/platform-tools/adb")
_EMU_SERIAL = os.environ.get("ANDROID_EMULATOR_SERIAL", "emulator-5554")
EMULATOR = os.path.expanduser("~/Android/Sdk/emulator/emulator")
AVDMANAGER = os.path.expanduser("~/Android/Sdk/cmdline-tools/latest/bin/avdmanager")


def _run(cmd, timeout=30):
    """Run a command, return (stdout, stderr, returncode)."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timed out", -1


def _adb(*args, timeout=30):
    """Run an adb command targeting the emulator."""
    return _run([ADB, "-s", _EMU_SERIAL] + list(args), timeout=timeout)


def _adb_shell(*args, timeout=30):
    """Run adb shell <args>."""
    return _run([ADB, "-s", _EMU_SERIAL, "shell"] + list(args), timeout=timeout)


def _ok(data):
    return json.dumps({"success": True, **data})


def _err(msg):
    return json.dumps({"success": False, "error": msg})


def register(ctx):
    # ── emu_status ──────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_status",
        toolset="android_emulator",
        schema={
            "name": "emu_status",
            "description": "Check emulator status: device list, Android version, model, boot state, screen size, available storage.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
        handler=lambda p, **kw: _handle_status(),
    )

    # ── emu_shell ───────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_shell",
        toolset="android_emulator",
        schema={
            "name": "emu_shell",
            "description": "Run an arbitrary adb shell command on the emulator. Returns stdout/stderr/exit code.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to run (e.g. 'ls /sdcard', 'pm list packages', 'dumpsys battery')",
                    },
                    "timeout_seconds": {
                        "type": "integer",
                        "description": "Timeout in seconds (default 30)",
                    },
                },
                "required": ["command"],
            },
        },
        handler=lambda p, **kw: _handle_shell(p),
    )

    # ── emu_install ─────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_install",
        toolset="android_emulator",
        schema={
            "name": "emu_install",
            "description": "Install an APK file on the emulator. Pass the local file path.",
            "parameters": {
                "type": "object",
                "properties": {
                    "apk_path": {
                        "type": "string",
                        "description": "Absolute path to the APK file on the host",
                    },
                    "replace": {
                        "type": "boolean",
                        "description": "Replace existing app (default true)",
                    },
                    "grant_permissions": {
                        "type": "boolean",
                        "description": "Grant all runtime permissions (default true)",
                    },
                },
                "required": ["apk_path"],
            },
        },
        handler=lambda p, **kw: _handle_install(p),
    )

    # ── emu_uninstall ───────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_uninstall",
        toolset="android_emulator",
        schema={
            "name": "emu_uninstall",
            "description": "Uninstall an app by package name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "package": {
                        "type": "string",
                        "description": "Package name (e.g. com.example.app)",
                    },
                },
                "required": ["package"],
            },
        },
        handler=lambda p, **kw: _handle_uninstall(p),
    )

    # ── emu_screenshot ──────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_screenshot",
        toolset="android_emulator",
        schema={
            "name": "emu_screenshot",
            "description": "Take a screenshot of the emulator display. Returns the local file path.",
            "parameters": {
                "type": "object",
                "properties": {
                    "output_path": {
                        "type": "string",
                        "description": "Where to save the PNG (default: /tmp/emu_screenshot.png)",
                    },
                },
                "required": [],
            },
        },
        handler=lambda p, **kw: _handle_screenshot(p),
    )

    # ── emu_tap ─────────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_tap",
        toolset="android_emulator",
        schema={
            "name": "emu_tap",
            "description": "Tap the screen at (x, y) coordinates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "integer", "description": "X coordinate"},
                    "y": {"type": "integer", "description": "Y coordinate"},
                },
                "required": ["x", "y"],
            },
        },
        handler=lambda p, **kw: _handle_tap(p),
    )

    # ── emu_swipe ───────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_swipe",
        toolset="android_emulator",
        schema={
            "name": "emu_swipe",
            "description": "Swipe from (x1,y1) to (x2,y2) over duration_ms milliseconds.",
            "parameters": {
                "type": "object",
                "properties": {
                    "x1": {"type": "integer", "description": "Start X"},
                    "y1": {"type": "integer", "description": "Start Y"},
                    "x2": {"type": "integer", "description": "End X"},
                    "y2": {"type": "integer", "description": "End Y"},
                    "duration_ms": {
                        "type": "integer",
                        "description": "Duration in ms (default 300)",
                    },
                },
                "required": ["x1", "y1", "x2", "y2"],
            },
        },
        handler=lambda p, **kw: _handle_swipe(p),
    )

    # ── emu_type ────────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_type",
        toolset="android_emulator",
        schema={
            "name": "emu_type",
            "description": "Type text on the emulator (uses adb shell input text). Spaces must be escaped with %s.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Text to type. Use %s for spaces.",
                    },
                },
                "required": ["text"],
            },
        },
        handler=lambda p, **kw: _handle_type(p),
    )

    # ── emu_key ─────────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_key",
        toolset="android_emulator",
        schema={
            "name": "emu_key",
            "description": "Press a key event. Common codes: HOME, BACK, ENTER, DEL, POWER, VOLUME_UP, VOLUME_DOWN, TAB, ESCAPE, DPAD_UP/DOWN/LEFT/RIGHT, MENU.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keycode": {
                        "type": "string",
                        "description": "Android keycode name (e.g. KEYCODE_HOME, HOME, BACK, ENTER)",
                    },
                },
                "required": ["keycode"],
            },
        },
        handler=lambda p, **kw: _handle_key(p),
    )

    # ── emu_launch ──────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_launch",
        toolset="android_emulator",
        schema={
            "name": "emu_launch",
            "description": "Launch an app by package name, or open a URL in the browser.",
            "parameters": {
                "type": "object",
                "properties": {
                    "package": {
                        "type": "string",
                        "description": "Package name to launch (e.g. com.android.chrome). If omitted, use url.",
                    },
                    "activity": {
                        "type": "string",
                        "description": "Specific activity (e.g. com.android.chrome.Main). Optional — uses default launcher if omitted.",
                    },
                    "url": {
                        "type": "string",
                        "description": "URL to open in browser (if package is omitted)",
                    },
                },
                "required": [],
            },
        },
        handler=lambda p, **kw: _handle_launch(p),
    )

    # ── emu_packages ────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_packages",
        toolset="android_emulator",
        schema={
            "name": "emu_packages",
            "description": "List installed packages. Optionally filter by keyword.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filter": {
                        "type": "string",
                        "description": "Optional grep filter (e.g. 'google', 'com.example')",
                    },
                },
                "required": [],
            },
        },
        handler=lambda p, **kw: _handle_packages(p),
    )

    # ── emu_push ────────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_push",
        toolset="android_emulator",
        schema={
            "name": "emu_push",
            "description": "Push a file from the host to the emulator.",
            "parameters": {
                "type": "object",
                "properties": {
                    "local_path": {
                        "type": "string",
                        "description": "Local file path on the host",
                    },
                    "remote_path": {
                        "type": "string",
                        "description": "Destination path on the emulator (e.g. /sdcard/file.txt)",
                    },
                },
                "required": ["local_path", "remote_path"],
            },
        },
        handler=lambda p, **kw: _handle_push(p),
    )

    # ── emu_pull ────────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_pull",
        toolset="android_emulator",
        schema={
            "name": "emu_pull",
            "description": "Pull a file from the emulator to the host.",
            "parameters": {
                "type": "object",
                "properties": {
                    "remote_path": {
                        "type": "string",
                        "description": "Path on the emulator",
                    },
                    "local_path": {
                        "type": "string",
                        "description": "Destination path on the host",
                    },
                },
                "required": ["remote_path", "local_path"],
            },
        },
        handler=lambda p, **kw: _handle_pull(p),
    )

    # ── emu_logcat ──────────────────────────────────────────────────────
    ctx.register_tool(
        name="emu_logcat",
        toolset="android_emulator",
        schema={
            "name": "emu_logcat",
            "description": "Get recent logcat output. Optionally filter by tag/priority.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filter": {
                        "type": "string",
                        "description": "Logcat filter expression (e.g. 'ActivityManager:I *:S', '*:E'). Default: last 50 lines.",
                    },
                    "lines": {
                        "type": "integer",
                        "description": "Number of lines to retrieve (default 50)",
                    },
                },
                "required": [],
            },
        },
        handler=lambda p, **kw: _handle_logcat(p),
    )


# ── Handlers ──────────────────────────────────────────────────────────────

def _handle_status():
    out, err, rc = _adb("devices", "-l")
    if rc != 0:
        return _err(f"adb devices failed: {err}")

    devices = []
    for line in out.splitlines()[1:]:
        if line.strip() and "attached" not in line:
            devices.append(line.strip())

    if not devices:
        return _ok({"connected": False, "devices": []})

    # Gather device info
    info = {}
    for key, cmd in [
        ("android_version", ["getprop", "ro.build.version.release"]),
        ("sdk", ["getprop", "ro.build.version.sdk"]),
        ("model", ["getprop", "ro.product.model"]),
        ("screen_size", ["wm", "size"]),
        ("screen_density", ["wm", "density"]),
        ("boot_completed", ["getprop", "sys.boot_completed"]),
    ]:
        o, _, _ = _adb_shell(*cmd)
        info[key] = o

    # Disk space
    o, _, _ = _adb_shell("df", "-h", "/data")
    info["disk"] = o

    return _ok({"connected": True, "devices": devices, "info": info})


def _handle_shell(params):
    cmd = params.get("command", "")
    if not cmd:
        return _err("No command provided")
    timeout = params.get("timeout_seconds", 30)
    # Split the command for adb shell
    out, err, rc = _adb_shell("sh", "-c", cmd, timeout=timeout)
    return _ok({"stdout": out, "stderr": err, "exit_code": rc})


def _handle_install(params):
    apk = params.get("apk_path", "")
    if not apk or not os.path.exists(apk):
        return _err(f"APK not found: {apk}")
    args = [ADB, "-s", _EMU_SERIAL, "install"]
    if params.get("replace", True):
        args.append("-r")
    if params.get("grant_permissions", True):
        args.append("-g")
    args.append(apk)
    out, err, rc = _run(args, timeout=120)
    return _ok({"stdout": out, "stderr": err, "exit_code": rc})


def _handle_uninstall(params):
    pkg = params.get("package", "")
    if not pkg:
        return _err("No package name")
    out, err, rc = _adb("uninstall", pkg)
    return _ok({"stdout": out, "stderr": err, "exit_code": rc})


def _handle_screenshot(params):
    out_path = params.get("output_path", "/tmp/emu_screenshot.png")
    remote = "/sdcard/hermes_screenshot.png"
    _adb_shell("screencap", "-p", remote)
    out, err, rc = _adb("pull", remote, out_path)
    _adb_shell("rm", "-f", remote)
    if rc != 0:
        return _err(f"Screenshot failed: {err}")
    return _ok({"path": out_path, "size_bytes": os.path.getsize(out_path) if os.path.exists(out_path) else 0})


def _handle_tap(params):
    x, y = params["x"], params["y"]
    out, err, rc = _adb_shell("input", "tap", str(x), str(y))
    return _ok({"tapped": [x, y], "exit_code": rc})


def _handle_swipe(params):
    args = ["input", "swipe", str(params["x1"]), str(params["y1"]),
            str(params["x2"]), str(params["y2"]), str(params.get("duration_ms", 300))]
    out, err, rc = _adb_shell(*args)
    return _ok({"swiped": True, "exit_code": rc})


def _handle_type(params):
    text = params.get("text", "")
    if not text:
        return _err("No text provided")
    out, err, rc = _adb_shell("input", "text", text)
    return _ok({"typed": text, "exit_code": rc})


def _handle_key(params):
    keycode = params.get("keycode", "")
    if not keycode:
        return _err("No keycode")
    # Normalize — accept both "HOME" and "KEYCODE_HOME"
    if not keycode.startswith("KEYCODE_"):
        keycode = f"KEYCODE_{keycode}"
    out, err, rc = _adb_shell("input", "keyevent", keycode)
    return _ok({"key": keycode, "exit_code": rc})


def _handle_launch(params):
    url = params.get("url")
    pkg = params.get("package")
    activity = params.get("activity")

    if url and not pkg:
        out, err, rc = _adb_shell("am", "start", "-a", "android.intent.action.VIEW", "-d", url)
        return _ok({"launched": url, "stdout": out, "stderr": err, "exit_code": rc})

    if pkg:
        component = f"{pkg}/{activity}" if activity else pkg
        out, err, rc = _adb_shell("am", "start", "-n", component)
        return _ok({"launched": component, "stdout": out, "stderr": err, "exit_code": rc})

    return _err("Provide either 'package' or 'url'")


def _handle_packages(params):
    filt = params.get("filter", "")
    cmd = ["pm", "list", "packages"]
    if filt:
        cmd.append(filt)
    out, err, rc = _adb_shell(*cmd)
    packages = [line.replace("package:", "").strip() for line in out.splitlines() if line.startswith("package:")]
    return _ok({"count": len(packages), "packages": packages})


def _handle_push(params):
    local = params.get("local_path", "")
    remote = params.get("remote_path", "")
    if not local or not os.path.exists(local):
        return _err(f"Local file not found: {local}")
    out, err, rc = _adb("push", local, remote)
    return _ok({"pushed": local, "to": remote, "stdout": out, "exit_code": rc})


def _handle_pull(params):
    remote = params.get("remote_path", "")
    local = params.get("local_path", "")
    out, err, rc = _adb("pull", remote, local)
    return _ok({"pulled": remote, "to": local, "stdout": out, "exit_code": rc})


def _handle_logcat(params):
    lines = params.get("lines", 50)
    filt = params.get("filter", "")
    if filt:
        out, err, rc = _adb_shell("logcat", "-d", "-t", str(lines), filt)
    else:
        out, err, rc = _adb_shell("logcat", "-d", "-t", str(lines))
    return _ok({"lines": out.splitlines()[-lines:], "exit_code": rc})
