package app.lovable.rasd.local;

import android.system.Os;
import android.system.OsConstants;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/** Only encrypted vault envelopes, in the existing private files directory.
 * A same-directory rename replaces each snapshot atomically after file sync.
 * Directory sync persists metadata; any failure is reported, not hidden.
 */
@CapacitorPlugin(name = "RasdAtomicVault")
public class RasdAtomicVaultPlugin extends Plugin {
    private static final Object LOCK = new Object();
    private File target(PluginCall call) {
        String name = call.getString("name", "");
        switch (name) {
            case "primary": name = "rasd-private-v1.json"; break;
            case "previous": name = "rasd-private-previous-v1.json"; break;
            case "pending": name = "rasd-private-pending-v1.json"; break;
            default: throw new IllegalArgumentException("Unknown vault slot");
        }
        return new File(getContext().getFilesDir(), name);
    }

    private void syncDirectory(File directory) throws Exception {
        FileDescriptor fd = Os.open(directory.getAbsolutePath(),
            OsConstants.O_RDONLY | OsConstants.O_DIRECTORY, 0);
        try { Os.fsync(fd); } finally { Os.close(fd); }
    }

    @PluginMethod
    public void read(PluginCall call) {
        synchronized (LOCK) {
            try {
                File file = target(call);
                JSObject response = new JSObject();
                try (FileInputStream in = new FileInputStream(file);
                     ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                    response.put("data", new String(out.toByteArray(), StandardCharsets.UTF_8));
                    response.put("exists", true);
                } catch (java.io.FileNotFoundException e) {
                    // Only actual absence is empty; inaccessible storage is an error.
                    try {
                        Os.stat(file.getAbsolutePath());
                    } catch (android.system.ErrnoException errno) {
                        if (errno.errno != OsConstants.ENOENT) throw errno;
                        response.put("exists", false);
                        call.resolve(response);
                        return;
                    }
                    throw e;
                }
                call.resolve(response);
            } catch (Exception e) { call.reject("Unable to read private vault"); }
        }
    }

    @PluginMethod
    public void write(PluginCall call) {
        synchronized (LOCK) {
            File temp = null;
            try {
                File file = target(call);
                String data = call.getString("data");
                if (data == null || data.isEmpty()) throw new IllegalArgumentException();
                // One scratch slot per target bounds leftovers after process death.
                // It is never read as committed data. The lock prevents overlap.
                temp = new File(file.getParentFile(), file.getName() + ".atomic-tmp");
                try (FileOutputStream out = new FileOutputStream(temp)) {
                    out.write(data.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                    out.getFD().sync();
                }
                Os.rename(temp.getAbsolutePath(), file.getAbsolutePath());
                syncDirectory(file.getParentFile());
                call.resolve();
            } catch (Exception e) {
                call.reject("Unable to durably write private vault");
            } finally {
                if (temp != null && temp.exists()) temp.delete();
            }
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        synchronized (LOCK) {
            try {
                File file = target(call);
                try { Os.unlink(file.getAbsolutePath()); }
                catch (android.system.ErrnoException e) {
                    if (e.errno != OsConstants.ENOENT) throw e;
                }
                syncDirectory(file.getParentFile());
                call.resolve();
            } catch (Exception e) { call.reject("Unable to remove private vault slot"); }
        }
    }
}
