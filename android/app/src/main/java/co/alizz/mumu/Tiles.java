package co.alizz.mumu;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.TileService;

/** Botones del menú de arriba (donde está el brillo): agregar tarea y "ya llegué a casa". */
public final class Tiles {
    private Tiles() {}

    static void abrir(TileService s, String hash, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Store.abrir(hash), s, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (Build.VERSION.SDK_INT >= 34) s.startActivityAndCollapse(PendingIntent.getActivity(s, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        else s.startActivityAndCollapse(i);
    }

    public static class Tarea extends TileService {
        @Override public void onClick() { abrir(this, "nueva=tarea", 51); }
    }

    public static class Casa extends TileService {
        @Override public void onClick() { abrir(this, "casa=llegue", 52); }
    }
}
