package app.lovable.rasd.local;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** Optional app-specific PIN/pattern convenience unlock. No short credential
 * independently decrypts a portable backup. Requires a non-exportable
 * hardware-backed AndroidKeyStore HMAC key. Native persisted attempt cap is
 * defense in depth, not a guarantee against root/instrumented app attacks.
 * Enrollment must be exposed only after fresh master-password authentication.
 */
@CapacitorPlugin(name = "RasdAppLock")
public class RasdAppLockPlugin extends Plugin {
    private static final Object LOCK = new Object();
    private static final int MAX_FAILURES = 5;
    private static final String PREFIX = "rasd_app_lock_v1_";

    private String method(PluginCall call) {
        String value = call.getString("method", "");
        if (!"pin".equals(value) && !"pattern".equals(value))
            throw new IllegalArgumentException("Unknown app lock method");
        return value;
    }
    private String tag(PluginCall call) {
        String value = call.getString("vaultTag", "");
        if (!value.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("Invalid vault identity");
        return value;
    }
    private SharedPreferences prefs(String method) {
        return getContext().getSharedPreferences(PREFIX + method, Context.MODE_PRIVATE);
    }
    private KeyStore store() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        return ks;
    }
    private boolean hardware(SecretKey key) throws Exception {
        SecretKeyFactory factory = SecretKeyFactory.getInstance(key.getAlgorithm(), "AndroidKeyStore");
        KeyInfo info = (KeyInfo) factory.getKeySpec(key, KeyInfo.class);
        return info.isInsideSecureHardware();
    }
    private SecretKey existing(String method) throws Exception {
        java.security.Key key = store().getKey(PREFIX + method, null);
        if (!(key instanceof SecretKey) || !hardware((SecretKey)key))
            throw new IllegalStateException("Hardware-protected app lock unavailable");
        return (SecretKey)key;
    }
    private SecretKey generate(String method) throws Exception {
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(PREFIX + method,
            KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
            .setKeySize(256).setDigests(KeyProperties.DIGEST_SHA256).build());
        SecretKey key = generator.generateKey();
        if (!hardware(key)) {
            store().deleteEntry(PREFIX + method);
            throw new IllegalStateException("Hardware-backed Android Keystore is required");
        }
        return key;
    }
    private static boolean valid(String method, String secret) {
        if (secret == null) return false;
        if ("pin".equals(method)) {
            if (!secret.matches("[0-9]{6,12}") || secret.matches("([0-9])\\1+")) return false;
            return !"012345678901234567890123".contains(secret) && !"987654321098765432109876".contains(secret);
        }
        if (!secret.matches("[1-9]{6,9}")) return false;
        boolean[] used = new boolean[10];
        int previous = 0;
        for (char c : secret.toCharArray()) {
            int next = c - '0';
            if (used[next]) return false;
            if (previous != 0) {
                int r1 = (previous-1)/3, c1 = (previous-1)%3;
                int r2 = (next-1)/3, c2 = (next-1)%3;
                if ((r1+r2)%2 == 0 && (c1+c2)%2 == 0) {
                    int middle = ((r1+r2)/2)*3 + (c1+c2)/2 + 1;
                    if (middle != previous && middle != next && !used[middle]) return false;
                }
            }
            used[next] = true;
            previous = next;
        }
        return true;
    }
    private static String b64(byte[] raw) { return Base64.encodeToString(raw, Base64.NO_WRAP); }
    private static byte[] unb64(String value) { return Base64.decode(value, Base64.NO_WRAP); }
    private static byte[] aad(String method, String tag) {
        return ("rasd-app-lock-v1:" + method + ":" + tag).getBytes(StandardCharsets.UTF_8);
    }
    private static byte[] derive(SecretKey key, byte[] salt, String method, String tag, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(key);
        mac.update(salt);
        mac.update(aad(method, tag));
        return mac.doFinal(secret.getBytes(StandardCharsets.UTF_8));
    }
    private void clear(String method) throws Exception {
        // Delete the hardware key first; even a failed preference clear cannot
        // make the old encrypted convenience slot usable again.
        KeyStore ks = store();
        if (ks.containsAlias(PREFIX + method)) ks.deleteEntry(PREFIX + method);
        if (!prefs(method).edit().clear().commit()) throw new IllegalStateException("Unable to clear app lock");
    }

    @PluginMethod
    public void probe(PluginCall call) {
        synchronized (LOCK) {
            try {
                String m = method(call), t = tag(call);
                SharedPreferences p = prefs(m);
                boolean matches = t.equals(p.getString("tag", ""));
                boolean enabled = matches && p.contains("wrapped") && p.contains("salt") && p.contains("iv");
                if (enabled) { try { existing(m); } catch (Exception e) { enabled = false; } }
                JSObject result = new JSObject();
                result.put("enabled", enabled);
                result.put("blocked", enabled && p.getInt("failures", MAX_FAILURES) >= MAX_FAILURES);
                call.resolve(result);
            } catch (Exception e) { call.reject("Unable to inspect app lock"); }
        }
    }

    @PluginMethod
    public void enable(PluginCall call) {
        synchronized (LOCK) {
            byte[] raw = null, derived = null, wrapped = null;
            try {
                String m = method(call), t = tag(call), secret = call.getString("secret");
                if (!valid(m, secret)) throw new IllegalArgumentException("Invalid credential");
                raw = unb64(call.getString("keyBase64", ""));
                if (raw.length != 32) throw new IllegalArgumentException("Invalid vault key");
                clear(m);
                SecretKey key = generate(m);
                byte[] salt = new byte[32];
                new SecureRandom().nextBytes(salt);
                derived = derive(key, salt, m, t, secret);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(derived, "AES"));
                cipher.updateAAD(aad(m, t));
                wrapped = cipher.doFinal(raw);
                if (!prefs(m).edit().putString("tag", t).putString("salt", b64(salt))
                    .putString("iv", b64(cipher.getIV())).putString("wrapped", b64(wrapped))
                    .putInt("failures", 0).commit()) {
                    clear(m);
                    throw new IllegalStateException("Unable to persist app lock");
                }
                call.resolve();
            } catch (Exception e) { call.reject("تعذر تفعيل الرمز أو النمط؛ يلزم جهاز يدعم حماية Keystore العتادية."); }
            finally {
                if (raw != null) Arrays.fill(raw, (byte)0);
                if (derived != null) Arrays.fill(derived, (byte)0);
                if (wrapped != null) Arrays.fill(wrapped, (byte)0);
            }
        }
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        synchronized (LOCK) {
            byte[] derived = null, raw = null;
            try {
                String m = method(call), t = tag(call), secret = call.getString("secret");
                SharedPreferences p = prefs(m);
                int failures = p.getInt("failures", MAX_FAILURES);
                if (!t.equals(p.getString("tag", "")) || failures < 0 || failures >= MAX_FAILURES)
                    throw new IllegalStateException("App lock disabled or blocked");
                // Persist BEFORE doing any credential-dependent work. Process
                // termination or reboot cannot reset a consumed attempt.
                if (!p.edit().putInt("failures", failures+1).commit())
                    throw new IllegalStateException("Unable to persist attempt");
                if (!valid(m, secret)) throw new IllegalArgumentException("Invalid credential");
                derived = derive(existing(m), unb64(p.getString("salt", "")), m, t, secret);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(derived, "AES"),
                    new GCMParameterSpec(128, unb64(p.getString("iv", ""))));
                cipher.updateAAD(aad(m,t));
                raw = cipher.doFinal(unb64(p.getString("wrapped", "")));
                if (raw.length != 32 || !p.edit().putInt("failures", 0).commit())
                    throw new IllegalStateException("Unable to reset app lock attempts");
                JSObject result = new JSObject();
                result.put("keyBase64", b64(raw));
                call.resolve(result);
            } catch (Exception e) { call.reject("الرمز أو النمط غير صحيح أو أُوقف الاختصار. استخدم كلمة المرور الرئيسية."); }
            finally {
                if (derived != null) Arrays.fill(derived, (byte)0);
                if (raw != null) Arrays.fill(raw, (byte)0);
            }
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        synchronized (LOCK) {
            try { clear(method(call)); call.resolve(); }
            catch (Exception e) { call.reject("Unable to remove app lock"); }
        }
    }
}
