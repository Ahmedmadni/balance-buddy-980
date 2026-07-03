// =============================================================
// Device Services Layer — capability interfaces + implementations.
// -------------------------------------------------------------
// Same shape as the NotificationProvider pattern from
// src/lib/notifications/provider.ts: one interface, a Web implementation
// that's real (browser APIs only), and a Capacitor implementation that's
// a capability-probe stub (no plugin actually installed in this build —
// see platform.ts's getCapacitorPlugin(), which looks plugins up on
// `window.Capacitor.Plugins` at runtime with no static import).
//
// File export intentionally DELEGATES to the existing backup engine
// (exportUserData/downloadJSON) instead of re-implementing file writing.
// =============================================================
import { getCapacitorPlugin, isNative } from "./platform";
import { exportUserData, downloadJSON, type BackupScope } from "@/lib/backup/engine";

export type PermissionStatus = "granted" | "denied" | "prompt" | "unsupported";
export type ActionResult = { ok: boolean; reason?: string };

export interface DeviceStorageProvider {
  isSupported(): boolean;
  getUsage(): Promise<{ usedBytes: number | null; quotaBytes: number | null }>;
}

export interface DeviceNotificationProvider {
  isSupported(): boolean;
  getPermissionStatus(): Promise<PermissionStatus>;
}

export interface DeviceShareProvider {
  isSupported(): boolean;
  share(data: { title?: string; text?: string; url?: string }): Promise<ActionResult>;
}

export interface DeviceFileProvider {
  isSupported(): boolean;
  exportBackup(scope?: BackupScope): Promise<ActionResult>;
}

// ----- Web implementations (real) -----

export class WebDeviceStorageProvider implements DeviceStorageProvider {
  isSupported() {
    return typeof navigator !== "undefined" && !!navigator.storage?.estimate;
  }
  async getUsage() {
    if (!this.isSupported()) return { usedBytes: null, quotaBytes: null };
    const est = await navigator.storage.estimate();
    return { usedBytes: est.usage ?? null, quotaBytes: est.quota ?? null };
  }
}

export class WebDeviceNotificationProvider implements DeviceNotificationProvider {
  isSupported() {
    return typeof Notification !== "undefined";
  }
  async getPermissionStatus(): Promise<PermissionStatus> {
    if (!this.isSupported()) return "unsupported";
    const p = Notification.permission;
    return p === "granted" ? "granted" : p === "denied" ? "denied" : "prompt";
  }
}

export class WebDeviceShareProvider implements DeviceShareProvider {
  isSupported() {
    return typeof navigator !== "undefined" && typeof navigator.share === "function";
  }
  async share(data: { title?: string; text?: string; url?: string }): Promise<ActionResult> {
    if (!this.isSupported()) return { ok: false, reason: "unsupported" };
    try {
      await navigator.share(data);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "share_cancelled_or_failed" };
    }
  }
}

export class WebDeviceFileProvider implements DeviceFileProvider {
  isSupported() {
    return typeof Blob !== "undefined";
  }
  async exportBackup(scope: BackupScope = "full"): Promise<ActionResult> {
    if (!this.isSupported()) return { ok: false, reason: "unsupported" };
    const bundle = await exportUserData(scope);
    downloadJSON(bundle);
    return { ok: true };
  }
}

// ----- Capacitor implementations (capability stubs) -----
// Each checks for the matching native plugin on window.Capacitor.Plugins
// and falls back to the Web implementation's behavior (the WebView still
// exposes localStorage/IndexedDB/navigator.storage), so nothing here
// silently does less than the web build until a native-only feature is
// genuinely required.

export class CapacitorDeviceStorageProvider extends WebDeviceStorageProvider {}

export class CapacitorDeviceNotificationProvider implements DeviceNotificationProvider {
  isSupported() {
    return !!getCapacitorPlugin("LocalNotifications") || typeof Notification !== "undefined";
  }
  async getPermissionStatus(): Promise<PermissionStatus> {
    const plugin = getCapacitorPlugin("LocalNotifications");
    if (!plugin) return new WebDeviceNotificationProvider().getPermissionStatus();
    try {
      const res = await plugin.checkPermissions?.();
      const display = res?.display;
      return display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt";
    } catch {
      return "unsupported";
    }
  }
}

export class CapacitorDeviceShareProvider implements DeviceShareProvider {
  isSupported() {
    return !!getCapacitorPlugin("Share") || new WebDeviceShareProvider().isSupported();
  }
  async share(data: { title?: string; text?: string; url?: string }): Promise<ActionResult> {
    const plugin = getCapacitorPlugin("Share");
    if (!plugin) return new WebDeviceShareProvider().share(data);
    try {
      await plugin.share(data);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "native_share_failed" };
    }
  }
}

export class CapacitorDeviceFileProvider extends WebDeviceFileProvider {}

export function createDeviceProviders() {
  const native = isNative();
  return {
    storage: native ? new CapacitorDeviceStorageProvider() : new WebDeviceStorageProvider(),
    notifications: native
      ? new CapacitorDeviceNotificationProvider()
      : new WebDeviceNotificationProvider(),
    share: native ? new CapacitorDeviceShareProvider() : new WebDeviceShareProvider(),
    files: native ? new CapacitorDeviceFileProvider() : new WebDeviceFileProvider(),
  };
}
