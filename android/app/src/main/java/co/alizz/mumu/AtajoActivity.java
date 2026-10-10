package co.alizz.mumu;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Toast;

/**
 * Atajos que MuMu (la web) puede abrir:
 *  mumu://permiso     → Ajustes de "Acceso al uso"; al volver, MuMu lee el uso de nuevo
 *  mumu://permisos    → notificaciones, alarmas exactas y alarma a pantalla completa
 *  mumu://ubicacion   → ubicación (para avisarte cuando llegas a casa)
 *  mumu://enlazar?t=  → guarda el token y trae el plan
 *  mumu://abrir       → vuelve a abrir MuMu leyendo el uso
 */
public class AtajoActivity extends Activity {
    private String paso = null;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Uri data = getIntent().getData();
        String host = data != null ? data.getHost() : "";
        try {
            if ("permiso".equals(host)) {
                paso = "uso";
                ajustes = true; startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
                return;
            }
            if ("enlazar".equals(host)) {
                String t = data.getQueryParameter("t");
                if (t != null && t.matches("[\\w-]{40,64}")) {
                    Store.token(this, t);
                    Sync.enSegundoPlano(this);
                    Toast.makeText(this, "Celular enlazado con MuMu", Toast.LENGTH_SHORT).show();
                }
                finish();
                return;
            }
            if ("permisos".equals(host)) { paso = "notif"; siguiente(); return; }
            if ("probar".equals(host)) {
                // Prueba: suena en 10 segundos (bloquea la pantalla para verla como en la mañana)
                org.json.JSONObject x = new org.json.JSONObject().put("kind", "alarm").put("title", "¡Arriba, Aliz!")
                        .put("text", "Esto es una prueba. Así va a sonar en la mañana.").put("open", "ir=alarmas");
                AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
                long at = System.currentTimeMillis() + 10000;
                android.app.PendingIntent pi = Aviso.pending(this, "prueba", x);
                if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, Aviso.abrir(this, "ir=alarmas", 9)), pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                NotificationManager nm = getSystemService(NotificationManager.class);
                if (Build.VERSION.SDK_INT >= 34 && !nm.canUseFullScreenIntent()) {
                    Toast.makeText(this, "Activa MuMu aquí para que salga la pantalla de alarma. Suena en 10 s.", Toast.LENGTH_LONG).show();
                    startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getPackageName())));
                } else Toast.makeText(this, "Suena en 10 segundos: bloquea la pantalla", Toast.LENGTH_LONG).show();
                finish();
                return;
            }
            if ("ubicacion".equals(host)) {
                paso = "ubic";
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 2);
                else fondo();
                return;
            }
            abrirMuMu();
        } catch (Exception ignored) { finish(); }
    }

    /** Pide los permisos de avisos uno por uno. */
    private void siguiente() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        if ("notif".equals(paso)) {
            paso = "exacta";
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
                return;
            }
        }
        if ("exacta".equals(paso)) {
            paso = "full";
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                ajustes = true; startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
                return;
            }
        }
        if ("full".equals(paso)) {
            paso = "fin";
            if (Build.VERSION.SDK_INT >= 34 && !nm.canUseFullScreenIntent()) {
                ajustes = true; startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getPackageName())));
                return;
            }
        }
        Aviso.canales(this);
        Sync.enSegundoPlano(this);
        Toast.makeText(this, "Listo: alarmas y avisos activados", Toast.LENGTH_SHORT).show();
        finish();
    }

    private void fondo() {
        paso = "fin-ubic";
        if (Build.VERSION.SDK_INT >= 29 && checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "Elige \"Permitir todo el tiempo\" para avisarte al llegar a casa", Toast.LENGTH_LONG).show();
            requestPermissions(new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION}, 3);
            return;
        }
        Sync.enSegundoPlano(this);
        finish();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] p, int[] r) {
        if (code == 1) siguiente();
        else if (code == 2) { if (r.length > 0 && r[0] == PackageManager.PERMISSION_GRANTED) fondo(); else finish(); }
        else { Sync.enSegundoPlano(this); finish(); }
    }

    // Solo cuando se fue a una pantalla de Ajustes y volvió
    private boolean ajustes = false, salio = false;
    @Override protected void onPause() { super.onPause(); if (ajustes) salio = true; }

    @Override
    protected void onResume() {
        super.onResume();
        if (!ajustes || !salio) return;
        ajustes = false; salio = false;
        if ("uso".equals(paso)) { abrirMuMu(); return; } // vuelve de Ajustes: relee el uso con el permiso nuevo
        if ("exacta".equals(paso) || "full".equals(paso) || "fin".equals(paso)) { siguiente(); return; }
    }

    private void abrirMuMu() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(i);
        finish();
    }
}
