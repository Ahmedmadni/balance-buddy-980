// TanStack Start emits an SSR client bundle, not a static index.html. Capacitor
// requires a local entrypoint even when production uses a hosted server.url.
// This local page is only a network-failure fallback, NOT an offline Rasd UI.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const webDir = resolve("dist/client");
if (!existsSync(webDir)) {
  throw new Error("dist/client not found. Run the production web build first.");
}
const entry = resolve(webDir, "index.html");
if (!existsSync(entry)) {
  mkdirSync(webDir, { recursive: true });
  writeFileSync(entry, `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>رصد — وضع عدم الاتصال</title>
<style>
@font-face{font-family:IBMArabic;src:url('/fonts/IBM-Plex-Sans-Arabic-Regular.ttf') format('truetype');font-weight:400;font-display:swap}
body{margin:0;display:grid;place-items:center;min-height:100dvh;background:#0b1220;color:#f8fafc;font-family:IBMArabic,system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
main{max-width:390px;line-height:1.8}button{padding:12px 20px;margin-top:15px;border:0;border-radius:12px;background:#0d9488;color:white;font:inherit;cursor:pointer}
</style></head><body><main><h1>رصد</h1><p>يحتاج هذا الإصدار إلى اتصال بالإنترنت لفتح بياناتك. يرجى التحقق من الشبكة ثم إعادة المحاولة.</p><button onclick="location.reload()">إعادة المحاولة</button></main></body></html>`, "utf8");
}
console.log("Android web assets prepared. Native release still uses its HTTPS server.url.");
