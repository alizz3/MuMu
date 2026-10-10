package co.alizz.mumu;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

/**
 * Trae de MuMu el plan (alarmas, recordatorios, widget, casa), lo programa en el celular
 * y sube el tiempo de pantalla. Corre al abrir la app, cada ~30 min y al prender el celular.
 */
final class Sync {
    private Sync() {}

    static void enSegundoPlano(Context c) {
        final Context app = c.getApplicationContext();
        new Thread(() -> { try { ahora(app); } catch (Exception ignored) { } }).start();
    }

    static void ahora(Context c) throws Exception {
        programarTrabajo(c);
        String token = Store.token(c);
        if (token == null) { programar(c); Widget.actualizar(c); return; }
        // 1) Subir el uso del celular
        try {
            if (Uso.permitido(c)) {
                JSONObject u = Uso.json(c, 3);
                JSONObject body = new JSONObject();
                body.put("d", u.optJSONObject("d"));
                body.put("l", u.optJSONObject("l"));
                http(c, "POST", "/api/device/uso", body.toString());
            }
        } catch (Exception ignored) { }
        // 2) Traer el plan
        String plan = http(c, "GET", "/api/device/plan", null);
        if (plan != null && plan.startsWith("{")) Store.plan(c, plan);
        programar(c);
        Widget.actualizar(c);
    }

    private static String http(Context c, String metodo, String ruta, String body) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(Store.WEB + ruta).openConnection();
        h.setConnectTimeout(15000);
        h.setReadTimeout(20000);
        h.setRequestMethod(metodo);
        h.setRequestProperty("X-Mumu-Device", Store.token(c));
        h.setRequestProperty("Accept", "application/json");
        if (body != null) {
            h.setDoOutput(true);
            h.setRequestProperty("Content-Type", "application/json");
            try (OutputStream o = h.getOutputStream()) { o.write(body.getBytes(StandardCharsets.UTF_8)); }
        }
        int code = h.getResponseCode();
        if (code == 401) { Store.token(c, null); return null; } // se desenlazó
        if (code >= 400) return null;
        try (InputStream in = h.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] b = new byte[8192]; int n;
            while ((n = in.read(b)) > 0) out.write(b, 0, n);
            return out.toString("UTF-8");
        } finally { h.disconnect(); }
    }

    /** Cancela lo programado antes y programa lo del plan nuevo. */
    static void programar(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        Set<String> antes = Store.p(c).getStringSet("ids", new HashSet<>());
        for (String id : antes) am.cancel(Aviso.pending(c, id, null));
        Set<String> nuevos = new HashSet<>();
        try {
            JSONObject plan = new JSONObject(Store.plan(c));
            JSONArray items = plan.optJSONArray("plan");
            long ahora = System.currentTimeMillis();
            boolean exacto = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject x = items.getJSONObject(i);
                long at = x.optLong("at");
                if (at <= ahora) continue;
                String id = x.optString("id");
                PendingIntent pi = Aviso.pending(c, id, x);
                if ("alarm".equals(x.optString("kind"))) {
                    PendingIntent ver = PendingIntent.getActivity(c, 7, new Intent(Intent.ACTION_VIEW, Store.abrir("ir=plan"), c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
                    if (exacto) am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, ver), pi);
                    else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } else if (exacto) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                }
                nuevos.add(id);
            }
            casa(c, plan.optJSONObject("home"));
        } catch (Exception ignored) { }
        Store.p(c).edit().putStringSet("ids", nuevos).apply();
    }

    /** Aviso al llegar a la casa (sin Google Play Services: alerta de proximidad del sistema). */
    static void casa(Context c, JSONObject home) {
        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(c, 42, new Intent(c, CasaReceiver.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
        try { lm.removeProximityAlert(pi); } catch (Exception ignored) { }
        if (home == null || !home.has("lat")) return;
        if (c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        try { lm.addProximityAlert(home.optDouble("lat"), home.optDouble("lng"), (float) home.optDouble("r", 150), -1, pi); } catch (SecurityException ignored) { }
    }

    static void programarTrabajo(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js.getPendingJob(1) != null) return;
        js.schedule(new JobInfo.Builder(1, new ComponentName(c, SyncJob.class))
                .setPeriodic(30 * 60 * 1000L)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true)
                .build());
    }
}
