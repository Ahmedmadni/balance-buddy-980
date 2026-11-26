#!/usr/bin/env python3
"""Exercise the real offline APK UI and app-private encrypted storage via ADB.
Only synthetic CI data are used; never run against a personal device.
"""
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

APP = "app.lovable.rasd.local"
PASS = "RasdCiTest2026Only"
WALLET = "OfflineCiWallet9271"

def adb(*args):
    return subprocess.check_output(["adb", *args], text=True, timeout=35)

def shell(*args):
    return adb("shell", *args)

def nodes():
    shell("uiautomator", "dump", "/sdcard/rasd-persistence.xml")
    return list(ET.fromstring(shell("cat", "/sdcard/rasd-persistence.xml")).iter("node"))

def wait_for(predicate, description, timeout=45):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            match = predicate(nodes())
            if match is not None and match is not False:
                return match
        except (ET.ParseError, subprocess.SubprocessError):
            pass
        time.sleep(1)
    # Synthetic CI data only; keep failure evidence for diagnosis.
    try:
        evidence = Path("android-offline-evidence")
        evidence.mkdir(exist_ok=True)
        shell("uiautomator", "dump", "/sdcard/rasd-persistence.xml")
        (evidence / "persistence-failure.xml").write_text(shell("cat", "/sdcard/rasd-persistence.xml"), encoding="utf-8")
        with (evidence / "persistence-failure.png").open("wb") as image:
            subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=image, check=True, timeout=15)
    except (OSError, subprocess.SubprocessError):
        pass
    raise AssertionError("Timed out waiting for " + description)

def visible(node):
    bounds = [int(v) for v in re.findall(r"\d+", node.get("bounds", ""))]
    return len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1]

def find_text(items, text):
    candidates = [n for n in items if visible(n)]
    exact = next((n for n in candidates if text in (
        n.get("text", ""), n.get("content-desc", "")
    )), None)
    if exact is not None:
        return exact
    return next((n for n in candidates if (
        text in n.get("text", "") or text in n.get("content-desc", "")
    )), None)

def tap(node):
    x1,y1,x2,y2 = [int(v) for v in re.findall(r"\d+", node.get("bounds", ""))]
    shell("input", "tap", str((x1+x2)//2), str((y1+y2)//2))
    time.sleep(0.35)

def tap_text(text):
    tap(wait_for(lambda ns: find_text(ns, text), text))

def wallet_tab():
    # WebView accessibility dumps omit the fixed bottom navigation on API 35
    # even when it is visible (confirmed by CI screenshot). Use its equal-width
    # RTL layout, relative to the actual WebView bounds, not screen pixels.
    ns = nodes()
    node = find_text(ns, "تبويب المحافظ")
    if node is not None:
        tap(node)
        return
    views = [n for n in ns if visible(n) and n.get("class") == "android.webkit.WebView"]
    assert views, "No app WebView for navigation"
    x1,y1,x2,y2 = [int(v) for v in re.findall(r"\d+", views[0].get("bounds", ""))]
    shell("input", "tap", str(x1 + round((x2-x1)*0.7)), str(y2-round((y2-y1)*0.04)))
    time.sleep(0.5)

def enter(index, value):
    def field(ns):
        edits = [n for n in ns if visible(n) and n.get("class") == "android.widget.EditText"]
        return edits[index] if len(edits) > index else None
    tap(wait_for(field, "input field " + str(index)))
    shell("input", "text", value)
    time.sleep(0.5)
    ime = shell("dumpsys", "input_method")
    if re.search(r"mInputShown=true|mIsInputViewShown=true", ime):
        shell("input", "keyevent", "4")
        time.sleep(0.4)

def wait_text(text):
    wait_for(lambda ns: find_text(ns, text), text)

def start():
    shell("am", "force-stop", APP)
    shell("am", "start", "-W", "-n", APP + "/.MainActivity")

def envelope():
    raw = adb("exec-out", "run-as", APP, "cat", "files/rasd-private-v1.json")
    value = json.loads(raw)
    assert value["format"] == "rasd-android-local-v1"
    assert value["vault"]["data"] and value["vault"]["iv"]
    assert WALLET not in raw and PASS not in raw, "Plaintext leaked to private vault file"
    return raw

def main():
    assert shell("settings", "get", "global", "wifi_on").strip() == "0", "Wi-Fi not disabled"
    assert shell("settings", "get", "global", "mobile_data").strip() == "0", "Mobile data not disabled"
    # CI starts a fresh emulator. Never clear application data to make a test pass.
    wait_text("إنشاء خزنتك المحلية")
    enter(0, PASS)
    enter(1, PASS)
    tap_text("إنشاء خزنة مشفرة")
    wait_text("احفظ رمز استرداد الخزنة")
    tap_text("حفظت الرمز في مكان آمن")
    tap_text("فتح رصد")
    wait_text("إجمالي أرصدة المحافظ")
    initial = envelope()
    wallet_tab()
    wait_for(lambda ns: len([n for n in ns if visible(n) and n.get("class") == "android.widget.EditText"]) >= 2, "wallet editor")
    enter(0, WALLET)
    enter(1, "1234.56")
    tap_text("إضافة محفظة")
    wait_text(WALLET)
    wait_text("1,234.56")
    saved = envelope()
    assert saved != initial, "Encrypted file did not change after saving"
    start()
    wait_text("فتح الخزنة")
    enter(0, PASS)
    tap_text("فتح الخزنة")
    wait_text("إجمالي أرصدة المحافظ")
    wait_text("1,234.56")
    wallet_tab()
    wait_text(WALLET)
    assert envelope() == saved, "Reopening unexpectedly rewrote the committed snapshot"
    print("PASS: encrypted wallet persists across force-stop and password unlock with network disabled.")
    return saved

if __name__ == "__main__":
    main()
