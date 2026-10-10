package co.alizz.mumu;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Pantalla de alarma, oscurita para no encandilarte: la canción suena hasta que te levantes. */
public class Alarma extends Activity {
    static final int NOTIF = AlarmaService.NOTIF;
    private final Handler h = new Handler(Looper.getMainLooper());
    private TextView hora;

    /** Lo llama el aviso programado: arranca el servicio que suena. */
    static void sonar(Context c, String id, String title, String text, String open) {
        AlarmaService.sonar(c, title, text, open);
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        getWindow().setStatusBarColor(0xFF15101A);
        getWindow().setNavigationBarColor(0xFF15101A);
        final String open = getIntent().getStringExtra("open");
        if ("levante".equals(getIntent().getStringExtra("accion"))) { levantarme(open); return; }
        String title = getIntent().getStringExtra("title"), text = getIntent().getStringExtra("text");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(28), dp(48), dp(28), dp(40));
        root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{0xFF15101A, 0xFF241A2B}));
        root.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);

        ImageView vaca = new ImageView(this);
        vaca.setImageResource(R.mipmap.ic_launcher);
        vaca.setAlpha(0.92f);
        root.addView(vaca, new LinearLayout.LayoutParams(dp(110), dp(110)));

        hora = tv("", 64, true, 0xFFF4E9F7);
        hora.setPadding(0, dp(18), 0, 0);
        root.addView(hora);
        tic();
        root.addView(tv(title == null ? "¡Arriba, Aliz!" : title, 26, true, 0xFFF7A8C4));
        TextView msg = tv(text == null ? "" : text, 18, false, 0xFFCBB8D3);
        msg.setPadding(0, dp(14), 0, dp(36));
        msg.setLineSpacing(0, 1.15f);
        root.addView(msg);

        Button arriba = boton("¡Ya me levanté!", 0xFFE88AA8, 0xFF1B1320);
        arriba.setOnClickListener(v -> levantarme(open));
        root.addView(arriba, ancho());
        Button mas = boton("5 minutos más", 0xFF33263B, 0xFFE6D6EE);
        mas.setOnClickListener(v -> {
            AlarmaService.posponer(this, open);
            AlarmaService.parar(this);
            finish();
        });
        LinearLayout.LayoutParams lp = ancho(); lp.topMargin = dp(12);
        root.addView(mas, lp);
        setContentView(root);
    }

    private void levantarme(String open) {
        AlarmaService.parar(this);
        try {
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (Build.VERSION.SDK_INT >= 26 && km.isKeyguardLocked()) km.requestDismissKeyguard(this, null);
        } catch (Exception ignored) { }
        try { startActivity(new Intent(Intent.ACTION_VIEW, Store.abrir(open), this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
        finish();
    }

    private void tic() {
        if (hora == null) return;
        hora.setText(new SimpleDateFormat("h:mm", new Locale("es", "CO")).format(new Date()));
        h.postDelayed(this::tic, 15000);
    }

    @Override protected void onDestroy() { h.removeCallbacksAndMessages(null); super.onDestroy(); }

    private TextView tv(String s, int sp, boolean bold, int color) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(sp); t.setTextColor(color); t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD));
        return t;
    }
    private Button boton(String s, int bg, int fg) {
        Button b = new Button(this);
        b.setText(s); b.setTextSize(18); b.setTextColor(fg); b.setAllCaps(false);
        GradientDrawable d = new GradientDrawable(); d.setColor(bg); d.setCornerRadius(dp(30));
        b.setBackground(d); b.setPadding(0, dp(16), 0, dp(16));
        b.setStateListAnimator(null);
        return b;
    }
    private LinearLayout.LayoutParams ancho() { return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    public void onBackPressed() { /* para apagarla hay que tocar un botón */ }
}
