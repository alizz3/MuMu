package co.alizz.mumu;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Process;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Calcula los minutos de uso por app y por día, como Bienestar digital. */
final class Uso {
    private Uso() {}

    static boolean permitido(Context c) {
        AppOpsManager a = (AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
        int modo = Build.VERSION.SDK_INT >= 29
                ? a.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName())
                : a.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName());
        if (modo == AppOpsManager.MODE_DEFAULT)
            return c.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        return modo == AppOpsManager.MODE_ALLOWED;
    }

    /** JSON en base64url: { v, permiso, d: { "2026-10-08": { t, a: { paquete: min } } }, l: { paquete: nombre } } */
    static String resumen(Context c, int dias) throws Exception {
        byte[] b = json(c, dias).toString().getBytes(StandardCharsets.UTF_8);
        return Base64.encodeToString(b, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    static JSONObject json(Context c, int dias) throws Exception {
        JSONObject out = new JSONObject();
        out.put("v", 1);
        boolean ok = permitido(c);
        out.put("permiso", ok);
        if (ok) {
            UsageStatsManager usm = (UsageStatsManager) c.getSystemService(Context.USAGE_STATS_SERVICE);
            PackageManager pm = c.getPackageManager();
            Set<String> ignorar = new HashSet<>();
            ignorar.add("com.android.systemui");
            ignorar.add(c.getPackageName());
            for (ResolveInfo r : pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)) {
                ignorar.add(r.activityInfo.packageName);
            }
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            JSONObject porDia = new JSONObject();
            JSONObject nombres = new JSONObject();
            Calendar cal = Calendar.getInstance();
            cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0);
            long ahora = System.currentTimeMillis();
            for (int i = 0; i < dias; i++) {
                long ini = cal.getTimeInMillis();
                long fin = Math.min(ini + 24L * 3600 * 1000, ahora);
                Map<String, Long> ms = minutosDelDia(usm, ini, fin, ignorar);
                JSONObject apps = new JSONObject();
                long total = 0;
                for (Map.Entry<String, Long> e : ms.entrySet()) {
                    long min = Math.round(e.getValue() / 60000.0);
                    if (min < 1) continue;
                    apps.put(e.getKey(), min);
                    total += min;
                    if (!nombres.has(e.getKey())) nombres.put(e.getKey(), nombre(pm, e.getKey()));
                }
                if (total > 0) {
                    JSONObject dia = new JSONObject();
                    dia.put("t", total);
                    dia.put("a", apps);
                    porDia.put(f.format(cal.getTime()), dia);
                }
                cal.add(Calendar.DAY_OF_YEAR, -1);
            }
            out.put("d", porDia);
            out.put("l", nombres);
        }
        return out;
    }

    /**
     * Suma el tiempo en primer plano de cada app dentro del día, como Bienestar digital:
     * solo una app a la vez, se corta al apagar la pantalla y no se cuentan huecos.
     */
    private static Map<String, Long> minutosDelDia(UsageStatsManager usm, long ini, long fin, Set<String> ignorar) {
        Map<String, Long> total = new HashMap<>();
        UsageEvents ev = usm.queryEvents(ini, fin);
        UsageEvents.Event e = new UsageEvents.Event();
        String cur = null; long desde = 0; long pausa = -1; long ultimo = ini;
        while (ev.hasNextEvent()) {
            ev.getNextEvent(e);
            int t = e.getEventType();
            long ts = e.getTimeStamp();
            ultimo = ts;
            String p = e.getPackageName();
            if (t == 16 /* SCREEN_NON_INTERACTIVE */ || t == 17 /* KEYGUARD_SHOWN */) {
                if (cur != null) sumar(total, cur, (pausa >= 0 ? pausa : ts) - desde);
                cur = null; pausa = -1;
            } else if (t == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                if (p == null || ignorar.contains(p)) {
                    if (cur != null) sumar(total, cur, (pausa >= 0 ? pausa : ts) - desde);
                    cur = null; pausa = -1;
                    continue;
                }
                if (p.equals(cur)) { pausa = -1; continue; } // otra pantalla de la misma app
                if (cur != null) sumar(total, cur, (pausa >= 0 ? pausa : ts) - desde);
                cur = p; desde = ts; pausa = -1;
            } else if (t == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                if (p != null && p.equals(cur)) pausa = ts;
            }
        }
        if (cur != null) {
            long hasta = pausa >= 0 ? pausa : (fin >= System.currentTimeMillis() - 60000 ? fin : ultimo);
            sumar(total, cur, hasta - desde);
        }
        return total;
    }

    private static void sumar(Map<String, Long> m, String p, long ms) {
        if (ms <= 0) return;
        m.put(p, m.getOrDefault(p, 0L) + Math.min(ms, 6L * 3600 * 1000));
    }

    private static String nombre(PackageManager pm, String paquete) {
        try {
            ApplicationInfo ai = pm.getApplicationInfo(paquete, 0);
            return String.valueOf(pm.getApplicationLabel(ai));
        } catch (Exception e) {
            return paquete;
        }
    }
}
