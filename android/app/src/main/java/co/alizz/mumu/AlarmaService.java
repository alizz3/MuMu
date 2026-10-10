package co.alizz.mumu;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import org.json.JSONObject;

/**
 * La alarma de verdad: un servicio en primer plano que suena tu canción en bucle (aunque el
 * celular esté en silencio, porque usa el volumen de alarma), vibra y muestra la pantalla de alarma.
 * Solo se calla con "Ya me levanté", con "5 minutos más" o a los 10 minutos.
 */
public class AlarmaService extends Service {
    static final String CANAL = "alarma_v3";
    static final int NOTIF = 4242;
    static final String SONAR = "sonar", PARAR = "parar", POSPONER = "posponer";
    private MediaPlayer mp;
    private Vibrator vib;
    private PowerManager.WakeLock wl;
    private final Handler h = new Handler(Looper.getMainLooper());

    static void sonar(Context c, String title, String text, String open) {
        Intent i = new Intent(c, AlarmaService.class).setAction(SONAR).putExtra("title", title).putExtra("text", text).putExtra("open", open);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }

    static void parar(Context c) {
        try { c.startService(new Intent(c, AlarmaService.class).setAction(PARAR)); } catch (Exception ignored) { }
    }

    static Intent pantalla(Context c, String title, String text, String open) {
        return new Intent(c, Alarma.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION)
                .putExtra("title", title).putExtra("text", text).putExtra("open", open);
    }

    @Override
    public int onStartCommand(Intent i, int flags, int id) {
        String a = i != null ? i.getAction() : null;
        if (PARAR.equals(a)) { detener(); return START_NOT_STICKY; }
        if (POSPONER.equals(a)) { posponer(this, i.getStringExtra("open")); detener(); return START_NOT_STICKY; }
        String title = i != null ? i.getStringExtra("title") : null, text = i != null ? i.getStringExtra("text") : null, open = i != null ? i.getStringExtra("open") : "";
        if (title == null) title = "¡Arriba, Aliz!";
        if (text == null) text = "";
        canal(this);
        Intent p = pantalla(this, title, text, open);
        PendingIntent full = PendingIntent.getActivity(this, 900, p, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent levante = PendingIntent.getActivity(this, 901, new Intent(p).putExtra("accion", "levante"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent cinco = PendingIntent.getService(this, 902, new Intent(this, AlarmaService.class).setAction(POSPONER).putExtra("open", open), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(title).setContentText(text)
                .setCategory(Notification.CATEGORY_ALARM).setOngoing(true).setColor(0xFFE88AA8)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setFullScreenIntent(full, true).setContentIntent(full)
                .addAction(new Notification.Action.Builder(null, "¡Ya me levanté!", levante).build())
                .addAction(new Notification.Action.Builder(null, "5 min más", cinco).build());
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_MAX);
        Notification n = b.build();
        n.flags |= Notification.FLAG_INSISTENT;
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(NOTIF, n);
        reproducir();
        // Intenta abrir la pantalla de alarma directo (si el sistema lo permite; si no, sale por la notificación)
        try { startActivity(p); } catch (Exception ignored) { }
        h.removeCallbacksAndMessages(null);
        h.postDelayed(this::detener, 10 * 60 * 1000L);
        return START_NOT_STICKY;
    }

    static void canal(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CANAL, "Alarma (pantalla y canción)", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Despertador con tu canción");
        ch.setSound(null, null); // la canción la pone el servicio
        ch.setBypassDnd(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    private void reproducir() {
        pararSonido();
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "mumu:alarma");
            wl.acquire(11 * 60 * 1000L);
        } catch (Exception ignored) { }
        try {
            AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
            int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            if (am.getStreamVolume(AudioManager.STREAM_ALARM) < max * 0.6) am.setStreamVolume(AudioManager.STREAM_ALARM, (int) Math.ceil(max * 0.7), 0);
        } catch (Exception ignored) { }
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            mp.setDataSource(this, android.net.Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.arriba));
            mp.setLooping(true);
            mp.prepare();
            mp.start();
        } catch (Exception ignored) { }
        try {
            vib = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            long[] p = {0, 700, 800};
            if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createWaveform(p, 0), new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
            else vib.vibrate(p, 0);
        } catch (Exception ignored) { }
    }

    private void pararSonido() {
        try { if (mp != null) { mp.stop(); mp.release(); } } catch (Exception ignored) { }
        mp = null;
        try { if (vib != null) vib.cancel(); } catch (Exception ignored) { }
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
    }

    private void detener() {
        h.removeCallbacksAndMessages(null);
        pararSonido();
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        getSystemService(NotificationManager.class).cancel(NOTIF);
        stopSelf();
    }

    static void posponer(Context c, String open) {
        try {
            JSONObject x = new JSONObject().put("kind", "alarm").put("title", "¡Ahora sí, arriba!")
                    .put("text", "Ya tuviste tus 5 minutos. Pies al piso, salta, brinca y estírate.").put("open", open == null ? "" : open);
            AlarmManager am = (AlarmManager) c.getSystemService(ALARM_SERVICE);
            long at = System.currentTimeMillis() + 5 * 60 * 1000L;
            PendingIntent pi = Aviso.pending(c, "snooze", x);
            if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, Aviso.abrir(c, "ir=alarmas", 8)), pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (Exception ignored) { }
    }

    @Override public void onDestroy() { pararSonido(); super.onDestroy(); }
    @Override public IBinder onBind(Intent i) { return null; }
}
