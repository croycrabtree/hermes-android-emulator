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
