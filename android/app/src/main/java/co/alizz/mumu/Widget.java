package co.alizz.mumu;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Widget "MuMu hoy": lo próximo, tus tareas y botones para agregar o marcar que llegaste. */
public class Widget extends AppWidgetProvider {
    static final String REFRESCAR = "co.alizz.mumu.REFRESCAR";
    private static final int[] FILAS = {R.id.w_t1, R.id.w_t2, R.id.w_t3, R.id.w_t4};

    static void actualizar(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, Widget.class));
        if (ids.length > 0) m.updateAppWidget(ids, vista(c));
    }

    static RemoteViews vista(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
        JSONObject w = null;
        try { w = new JSONObject(Store.plan(c)).optJSONObject("widget"); } catch (Exception ignored) { }
        if (Store.token(c) == null) {
            v.setTextViewText(R.id.w_line, "Abre MuMu → Más → Alarmas → Enlazar");
        } else if (w != null) {
            v.setTextViewText(R.id.w_line, w.optString("line"));
        }
        JSONArray ts = w != null ? w.optJSONArray("tasks") : null;
        for (int i = 0; i < FILAS.length; i++) {
            JSONObject t = ts != null && i < ts.length() ? ts.optJSONObject(i) : null;
            if (t == null) { v.setViewVisibility(FILAS[i], View.GONE); continue; }
            String d = t.optString("d");
            v.setTextViewText(FILAS[i], "○  " + t.optString("t") + (d.isEmpty() ? "" : "  · " + d));
            v.setViewVisibility(FILAS[i], View.VISIBLE);
        }
        if (ts == null || ts.length() == 0) { v.setTextViewText(R.id.w_t1, "Sin pendientes. Disfruta ese espacio."); v.setViewVisibility(R.id.w_t1, View.VISIBLE); }
        v.setTextViewText(R.id.w_hab, w != null ? w.optString("habits") : "");
        v.setOnClickPendingIntent(R.id.w_root, Aviso.abrir(c, "ir=tareas", 31));
        v.setOnClickPendingIntent(R.id.w_add, Aviso.abrir(c, "nueva=tarea", 32));
        v.setOnClickPendingIntent(R.id.w_casa, Aviso.abrir(c, "casa=llegue", 33));
        Intent r = new Intent(c, Widget.class).setAction(REFRESCAR);
        v.setOnClickPendingIntent(R.id.w_ref, PendingIntent.getBroadcast(c, 34, r, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        m.updateAppWidget(ids, vista(c));
        Sync.enSegundoPlano(c);
    }

    @Override
    public void onReceive(Context c, Intent i) {
        super.onReceive(c, i);
        if (REFRESCAR.equals(i.getAction())) {
            PendingResult r = goAsync();
            new Thread(() -> { try { Sync.ahora(c); } catch (Exception ignored) { } actualizar(c); r.finish(); }).start();
        }
    }
}
