#!/usr/bin/env python3
"""Exercise the real offline APK UI and app-private encrypted storage via ADB.
Only synthetic CI data are used; never run against a personal device.
"""
import json
import os
import sys
import tempfile
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

def scroll_down():
    ns = nodes()
    view = next((n for n in ns if visible(n) and n.get("class") == "android.webkit.WebView"), None)
    assert view is not None, "Expected app WebView"
    x1,y1,x2,y2 = [int(v) for v in re.findall(r"\d+", view.get("bounds", ""))]
    x = (x1+x2)//2
    shell("input","swipe",str(x),str(y1+int((y2-y1)*.82)),str(x),str(y1+int((y2-y1)*.3)),"450")
    time.sleep(.5)

def scroll_find(*labels):
    for _ in range(8):
        ns = nodes()
        for label in labels:
            node = find_text(ns,label)
            if node is not None:
                return node
        scroll_down()
    raise AssertionError("Cannot locate " + repr(labels))

def enter_labeled(label,value):
    for _ in range(8):
        ns = nodes()
        edits = [n for n in ns if visible(n) and n.get("class") == "android.widget.EditText"]
        direct = next((n for n in edits if label in n.get("content-desc","") or label in n.get("text","")),None)
        if direct is not None:
            tap(direct)
            break
        label_node = find_text(ns,label)
        if label_node is not None and edits:
            bounds = lambda n: [int(v) for v in re.findall(r"\d+",n.get("bounds",""))]
            bottom = bounds(label_node)[3]
            below = [n for n in edits if bounds(n)[1] >= bottom-12]
            if below:
                tap(min(below,key=lambda n: bounds(n)[1]))
                break
        scroll_down()
    else:
        raise AssertionError("Cannot locate labeled field " + label)
    shell("input","text",value)
    time.sleep(.5)
    if re.search(r"mInputShown=true|mIsInputViewShown=true",shell("dumpsys","input_method")):
        shell("input","keyevent","4")
        time.sleep(.4)

def pick_backup(filename):
    tap(scroll_find("اختيار ملف نسخة رصد","Choose File","No file chosen"))
    # DocumentsUI may launch into Recent or Downloads, depending on the
    # emulator image. Use the real Android picker, not a private-file write.
    # ElementTree nodes with no children are falsey: test explicitly.
    def locate(ns):
        for label in (filename,"Show roots","Open from"):
            item=find_text(ns,label)
            if item is not None:
                return item
        return None
    item=wait_for(locate,"Android document picker")
    if filename not in item.get("text","") and filename not in item.get("content-desc",""):
        tap(item)
        tap_text("Downloads")
        item=wait_for(lambda ns: find_text(ns,filename),filename)
    tap(item)

def reinstall_restore(apk,saved):
    # Destructive operation is restricted to disposable CI Android emulators.
    assert os.environ.get("GITHUB_ACTIONS") == "true", "CI-only reinstall test"
    assert shell("getprop","ro.kernel.qemu").strip()=="1" or shell("getprop","ro.boot.qemu").strip()=="1", "Refusing uninstall on non-emulator"
    filename="rasd-ci-restore-9271.json"
    target="/sdcard/Download/"+filename
    shell("mkdir","-p","/sdcard/Download")
    with tempfile.TemporaryDirectory() as tmp:
        local=Path(tmp)/filename
        local.write_text(saved,encoding="utf-8")
        adb("push",str(local),target)
    # The exported test envelope is outside the application's private data.
    # No original or real user data is used in this CI environment.
    assert "Success" in adb("uninstall",APP)
    assert "Success" in adb("install",apk)
    start()
    wait_text("إنشاء خزنتك المحلية")
    tap(scroll_find("لدي نسخة رصد محلية مشفرة وأريد استعادتها"))
    pick_backup(filename)
    enter_labeled("كلمة مرور النسخة",PASS)
    tap(scroll_find("فحص ومعاينة النسخة"))
    scroll_find("تم التحقق من النسخة")
    # The preview must match the known synthetic ledger before replacement.
    assert find_text(nodes(),"1,234.56") is not None, "Wrong restore preview balance"
    enter_labeled("للتأكيد", "RESTORE")
    tap(scroll_find("استعادة النسخة المشفرة"))
    wait_text("إجمالي أرصدة المحافظ")
    wait_text("1,234.56")
    wallet_tab()
    wait_text(WALLET)
    assert envelope()==saved, "Restored encrypted file differs from exported snapshot"
    start()
    wait_text("فتح الخزنة")
    enter(0,PASS)
    tap_text("فتح الخزنة")
    wait_text("1,234.56")
    assert envelope()==saved, "Restored wallet failed durable restart"
    shell("rm","-f",target)
    print("PASS: real Android file picker, authenticated preview, reinstall restore and durable offline restart.")

if __name__ == "__main__":
    saved=main()
    if len(sys.argv)>1:
        reinstall_restore(sys.argv[1],saved)
