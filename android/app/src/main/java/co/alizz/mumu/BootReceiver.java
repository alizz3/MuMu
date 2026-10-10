package co.alizz.mumu;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Al prender el celular (o actualizar la app) se vuelven a programar las alarmas. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        PendingResult r = goAsync();
        new Thread(() -> {
            try { Sync.programar(c); Sync.ahora(c); } catch (Exception ignored) { }
            r.finish();
        }).start();
    }
}
