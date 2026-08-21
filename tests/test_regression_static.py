import ast
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "__init__.py"
API_SRC = ROOT / "dashboard" / "plugin_api.py"


def _get_register_tool_names() -> list[str]:
    tree = ast.parse(SRC.read_text(encoding="utf-8"), filename=str(SRC))
    names = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "register_tool"
        ):
            for kw in node.keywords:
                if kw.arg == "name" and isinstance(kw.value, ast.Constant):
                    names.append(kw.value.value)
    return names


def test_adb_shell_line_targets_serial():
    init_source = SRC.read_text(encoding="utf-8").splitlines()
    assert '[ADB, "-s", _EMU_SERIAL, "shell"] + list(args)' in init_source[28]


def test_adb_install_line_targets_serial():
    init_source = SRC.read_text(encoding="utf-8").splitlines()
    assert '[ADB, "-s", _EMU_SERIAL, "install"]' in init_source[409]


def test_device_online_line_uses_serial():
    api_source = API_SRC.read_text(encoding="utf-8").splitlines()
    assert "return _EMU_SERIAL in text and \"device\" in text.split(_EMU_SERIAL, 1)[-1].split" in api_source[46]


def test_plugin_registers_expected_tools():
    names = _get_register_tool_names()
    assert len(names) == 14
    assert sorted(names) == sorted([
        "emu_status",
        "emu_shell",
        "emu_install",
        "emu_uninstall",
        "emu_screenshot",
        "emu_tap",
        "emu_swipe",
        "emu_type",
        "emu_key",
        "emu_launch",
        "emu_packages",
        "emu_push",
        "emu_pull",
        "emu_logcat",
    ])
