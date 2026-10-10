package co.alizz.mumu;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

/** Pantalla de alarma: suena "¡Arriba, Aliz!" hasta que te levantes (o pidas 5 minutos más). */
public class Alarma extends Activity {
    static final int NOTIF = 4242;
    private static MediaPlayer mp;
    private static Vibrator vib;
    private final Handler h = new Handler(Looper.getMainLooper());

    static void sonar(Context c, String id, String title, String text, String open) {
        Aviso.canales(c);
        Intent pantalla = new Intent(c, Alarma.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION)
                .putExtra("title", title).putExtra("text", text).putExtra("open", open);
        PendingIntent full = PendingIntent.getActivity(c, 900, pantalla, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, Aviso.ALARMAS) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(title).setContentText(text)
                .setCategory(Notification.CATEGORY_ALARM).setOngoing(true).setColor(0xFFE88AA8)
                .setFullScreenIntent(full, true).setContentIntent(full);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_MAX);
        try { c.getSystemService(NotificationManager.class).notify(NOTIF, b.build()); } catch (SecurityException ignored) { }
        reproducir(c);
        try { c.startActivity(pantalla); } catch (Exception ignored) { } // si el sistema lo deja, abre directo
    }

    static void reproducir(Context c) {
        detener(c, false);
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            mp.setDataSource(c, android.net.Uri.parse("android.resource://" + c.getPackageName() + "/" + R.raw.arriba));
            mp.setLooping(true);
            mp.prepare();
            mp.start();
        } catch (Exception ignored) { }
        try {
            vib = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
            long[] p = {0, 600, 700};
            if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createWaveform(p, 0));
            else vib.vibrate(p, 0);
        } catch (Exception ignored) { }
        // Si nadie la apaga, se calla sola a los 10 minutos
        new Handler(Looper.getMainLooper()).postDelayed(() -> detener(c, true), 10 * 60 * 1000L);
    }

    static void detener(Context c, boolean quitarNotif) {
        try { if (mp != null) { mp.stop(); mp.release(); } } catch (Exception ignored) { }
        mp = null;
        try { if (vib != null) vib.cancel(); } catch (Exception ignored) { }
        if (quitarNotif) c.getSystemService(NotificationManager.class).cancel(NOTIF);
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        if (mp == null) reproducir(this);
        String title = getIntent().getStringExtra("title"), text = getIntent().getStringExtra("text");
        final String open = getIntent().getStringExtra("open");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(28), dp(48), dp(28), dp(48));
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{0xFFFCE4EC, 0xFFFFF8F6});
        root.setBackground(bg);

        ImageView vaca = new ImageView(this);
        vaca.setImageResource(R.mipmap.ic_launcher);
        root.addView(vaca, new LinearLayout.LayoutParams(dp(120), dp(120)));

        TextView hora = tv(new java.text.SimpleDateFormat("h:mm a", new java.util.Locale("es", "CO")).format(new java.util.Date()), 54, true, 0xFF3B2A3F);
        root.addView(hora);
        root.addView(tv(title == null ? "¡Arriba, Aliz!" : title, 26, true, 0xFFC2185B));
        TextView msg = tv(text == null ? "" : text, 18, false, 0xFF5B4A5F);
        msg.setPadding(0, dp(12), 0, dp(28));
        root.addView(msg);

        Button arriba = boton("¡Ya me levanté!", 0xFFE88AA8, Color.WHITE);
        arriba.setOnClickListener(v -> {
            detener(this, true);
            try { startActivity(new Intent(Intent.ACTION_VIEW, Store.abrir(open), this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
            finish();
        });
        root.addView(arriba, ancho());
        Button mas = boton("5 minutos más", 0xFFF3E5F5, 0xFF6A4C7A);
        mas.setOnClickListener(v -> {
            detener(this, true);
            try {
                JSONObject x = new JSONObject().put("kind", "alarm").put("title", "¡Ahora sí, arriba!").put("text", "Ya tuviste tus 5 minutos. Pies al piso, salta, brinca y estírate.").put("open", open == null ? "" : open);
                AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
                long at = System.currentTimeMillis() + 5 * 60 * 1000L;
                PendingIntent pi = Aviso.pending(this, "snooze", x);
                if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, Aviso.abrir(this, "ir=alarmas", 8)), pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } catch (Exception ignored) { }
            finish();
        });
        LinearLayout.LayoutParams lp = ancho(); lp.topMargin = dp(12);
        root.addView(mas, lp);
        setContentView(root);
    }

    private TextView tv(String s, int sp, boolean bold, int color) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(sp); t.setTextColor(color); t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }
    private Button boton(String s, int bg, int fg) {
        Button b = new Button(this);
        b.setText(s); b.setTextSize(18); b.setTextColor(fg); b.setAllCaps(false);
        GradientDrawable d = new GradientDrawable(); d.setColor(bg); d.setCornerRadius(dp(28));
        b.setBackground(d); b.setPadding(0, dp(14), 0, dp(14));
        return b;
    }
    private LinearLayout.LayoutParams ancho() { return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    public void onBackPressed() { /* para apagarla hay que tocar un botón */ }
}
