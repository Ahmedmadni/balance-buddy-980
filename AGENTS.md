# Architecture rules

- Complete managed social login on the public auth page and navigate into the guarded app only after a session is available; OAuth returns can precede session hydration.
- Keep Backup v2 file validation in a browser-safe pure module and perform data operations only through the existing export/restore RPCs; invalid files must never reach restore.
- Treat Android as a hosted HTTPS client of the SSR application until a local-shell architecture is explicitly implemented; do not remove its production server URL or claim full offline startup.