package app.lovable.rasd.local;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.KeyStore;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * A device-authenticated *cryptographic* shortcut for the Rasd offline vault.
 *
 * A key in AndroidKeyStore encrypts the existing random vault DEK, never
 * the financial data itself. AES/GCM is permitted ONLY after OS confirmation
 * via BiometricPrompt + CryptoObject. The user retains their master password
 * and recovery code if the Keystore key is invalidated or the phone is reset.
 *
 * No PIN, biometric template, plaintext vault key or master password is
 * persisted by this plugin. This feature is optional and requires API >= 30.
 */
@CapacitorPlugin(name = "RasdDeviceUnlock")
public class RasdDeviceUnlockPlugin extends Plugin {
    private static final int AUTH_FLAGS = BiometricManager.Authenticators.BIOMETRIC_STRONG
        | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
    private static final String ALIAS = "rasd_offline_vault_wrap_v1";
    private static final String PREFS = "rasd_offline_device_wrap_v1";
    private static final String P_IV = "iv";
    private static final String P_DATA = "data";
    private static final String P_TAG = "tag";
    private final AtomicBoolean inProgress = new AtomicBoolean(false);

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String encoded(byte[] value) {
        return Base64.encodeToString(value, Base64.NO_WRAP);
    }

    private static byte[] decoded(String value) {
        return Base64.decode(value, Base64.NO_WRAP);
    }

    private boolean supported() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return false;
        KeyguardManager guard = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        if (guard == null || !guard.isDeviceSecure()) return false;
        BiometricManager manager = getContext().getSystemService(BiometricManager.class);
        return manager != null && manager.canAuthenticate(AUTH_FLAGS)
            == BiometricManager.BIOMETRIC_SUCCESS;
    }

    private boolean validTag(String tag) {
        return tag != null && tag.matches("[a-f0-9]{64}");
    }

    private boolean keyExists() {
        try {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            return store.containsAlias(ALIAS);
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean saved() {
        return keyExists() && prefs().contains(P_DATA) &&
            prefs().contains(P_IV) && validTag(prefs().getString(P_TAG, ""));
    }

    private boolean sameVault(String tag) {
        return validTag(tag) && saved() && tag.equals(prefs().getString(P_TAG, ""));
    }

    @PluginMethod
    public void probe(PluginCall call) {
        String tag = call.getString("vaultTag");
        JSObject response = new JSObject();
        response.put("supported", supported());
        response.put("enabled", saved());
        response.put("matchesVault", sameVault(tag));
        call.resolve(response);
    }

    private SecretKey makeKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) store.deleteEntry(ALIAS);
        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"
        );
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .setUserAuthenticationParameters(0,
                KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL)
            .build());
        return generator.generateKey();
    }

    private SecretKey storedKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        KeyStore.Entry entry = store.getEntry(ALIAS, null);
        if (!(entry instanceof KeyStore.SecretKeyEntry)) {
            throw new IllegalStateException("Keystore entry missing");
        }
        return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
    }

    private void authenticate(Cipher cipher, PluginCall call,
                              java.util.function.Consumer<Cipher> success,
                              Runnable onAbort) {
        final CancellationSignal cancellation = new CancellationSignal();
        final BiometricPrompt prompt = new BiometricPrompt.Builder(getActivity())
            .setTitle("فتح خزنة رصد")
            .setSubtitle("البصمة أو الوجه القوي أو قفل شاشة Android")
            .setAllowedAuthenticators(AUTH_FLAGS)
            .build();
        getActivity().runOnUiThread(() -> {
            try {
                prompt.authenticate(new BiometricPrompt.CryptoObject(cipher), cancellation,
                    getActivity().getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        if (!inProgress.compareAndSet(true, false)) return;
                        try {
                            BiometricPrompt.CryptoObject crypto = result.getCryptoObject();
                            if (crypto == null || crypto.getCipher() == null) {
                                call.reject("لم يمنح Android إذن تشغيل مفتاح التشفير.");
                                return;
                            }
                            success.accept(crypto.getCipher());
                        } catch (Exception ignored) {
                            onAbort.run();
                            call.reject("تعذر استخدام مفتاح حماية الجهاز.");
                        }
                    }
                    @Override
                    public void onAuthenticationError(int code, CharSequence message) {
                        if (inProgress.compareAndSet(true, false)) {
                            onAbort.run();
                            call.reject("ألغي التحقق أو تعذّر استخدام قفل الجهاز.");
                        }
                    }
                });
            } catch (Exception ignored) {
                inProgress.set(false);
                onAbort.run();
                call.reject("تعذر فتح التحقق الآمن لنظام Android.");
            }
        });
    }

    @PluginMethod
    public void enable(PluginCall call) {
        if (!supported()) { call.reject("فعّل قفل شاشة Android أولًا، ثم جرّب جهازًا يدعم التحقق الآمن."); return; }
        if (!inProgress.compareAndSet(false, true)) { call.reject("جار تنفيذ تحقق آخر."); return; }
        byte[] raw = null;
        try {
            String tag = call.getString("vaultTag");
            String value = call.getString("keyBase64");
            if (!validTag(tag) || value == null) throw new IllegalArgumentException();
            raw = decoded(value);
            if (raw.length != 32) throw new IllegalArgumentException();
            // A clone survives this call, but is erased as soon as Android
            // authorizes or rejects the AES operation.
            final byte[] keyMaterial = raw;
            final String vaultTag = tag;
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, makeKey());
            authenticate(cipher, call, authorized -> {
                try {
                    byte[] cipherText = authorized.doFinal(keyMaterial);
                    boolean saved = prefs().edit()
                        .putString(P_IV, encoded(authorized.getIV()))
                        .putString(P_DATA, encoded(cipherText))
                        .putString(P_TAG, vaultTag)
                        .commit();
                    Arrays.fill(cipherText, (byte) 0);
                    if (!saved) { call.reject("تعذر حفظ إذن قفل Android محليًا."); return; }
                    call.resolve();
                } catch (Exception ignored) {
                    call.reject("تعذر حفظ مفتاح الدخول المحمي.");
                } finally {
                    Arrays.fill(keyMaterial, (byte) 0);
                }
            }, () -> Arrays.fill(keyMaterial, (byte) 0));
        } catch (Exception ignored) {
            if (raw != null) Arrays.fill(raw, (byte) 0);
            inProgress.set(false);
            call.reject("تعذر إعداد فتح رصد بقفل Android.");
        }
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        if (!supported()) { call.reject("قفل Android غير متاح الآن. استخدم كلمة المرور الرئيسية."); return; }
        String tag = call.getString("vaultTag");
        if (!sameVault(tag)) {
            call.reject("لم يُضبط فتح الجهاز لهذه الخزنة. استخدم كلمة المرور الرئيسية.");
            return;
        }
        if (!inProgress.compareAndSet(false, true)) { call.reject("جار تنفيذ تحقق آخر."); return; }
        try {
            byte[] iv = decoded(prefs().getString(P_IV, ""));
            byte[] data = decoded(prefs().getString(P_DATA, ""));
            if (iv.length != 12 || data.length < 16 || data.length > 80)
                throw new IllegalArgumentException();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, storedKey(), new GCMParameterSpec(128, iv));
            authenticate(cipher, call, authorized -> {
                byte[] raw = null;
                try {
                    raw = authorized.doFinal(data);
                    if (raw.length != 32) throw new IllegalArgumentException();
                    JSObject response = new JSObject();
                    response.put("keyBase64", encoded(raw));
                    call.resolve(response);
                } catch (Exception ignored) {
                    call.reject("فشل التحقق من مفتاح الخزنة. استخدم كلمة المرور الرئيسية.");
                } finally {
                    if (raw != null) Arrays.fill(raw, (byte) 0);
                    Arrays.fill(data, (byte) 0);
                }
            }, () -> Arrays.fill(data, (byte) 0));
        } catch (Exception ignored) {
            inProgress.set(false);
            call.reject("مفتاح قفل الجهاز مفقود أو تغير. استخدم كلمة المرور الرئيسية.");
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        if (!inProgress.compareAndSet(false, true)) { call.reject("جار تنفيذ تحقق آخر."); return; }
        try {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            if (store.containsAlias(ALIAS)) store.deleteEntry(ALIAS);
            if (!prefs().edit().clear().commit()) {
                call.reject("تعذر إزالة إذن الجهاز بالكامل.");
            } else call.resolve();
        } catch (Exception ignored) {
            call.reject("تعذر إزالة مفتاح الجهاز الآن.");
        } finally {
            inProgress.set(false);
        }
    }
}
