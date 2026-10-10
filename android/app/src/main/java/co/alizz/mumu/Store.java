package co.alizz.mumu;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

/** Lo poquito que la app guarda en el celular: el token de enlace y el último plan. */
final class Store {
    private Store() {}
    static final String WEB = "https://mu-mu-blond.vercel.app";

    static SharedPreferences p(Context c) { return c.getSharedPreferences("mumu", Context.MODE_PRIVATE); }
    static String token(Context c) { return p(c).getString("token", null); }
    static void token(Context c, String t) { p(c).edit().putString("token", t).apply(); }
    static String plan(Context c) { return p(c).getString("plan", "{}"); }
    static void plan(Context c, String json) { p(c).edit().putString("plan", json).putLong("planAt", System.currentTimeMillis()).apply(); }

    /** Enlace para abrir MuMu en una vista o atajo: #nueva=tarea, #casa=llegue, #ir=plan */
    static Uri abrir(String hash) {
        return Uri.parse(WEB + "/" + (hash == null || hash.isEmpty() ? "" : "#" + hash));
    }
}
