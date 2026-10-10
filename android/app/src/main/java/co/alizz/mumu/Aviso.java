package co.alizz.mumu;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import org.json.JSONObject;

/** Suena una alarma o muestra un recordatorio en la barra de notificaciones. */
public class Aviso extends BroadcastReceiver {
    static final String AVISOS = "avisos", ALARMAS = "alarmas2";

    static PendingIntent pending(Context c, String id, JSONObject x) {
        Intent i = new Intent(c, Aviso.class).setAction("co.alizz.mumu.AVISO").setData(Uri.parse("mumu-aviso://" + id));
        if (x != null) {
            i.putExtra("id", id);
            i.putExtra("kind", x.optString("kind"));
            i.putExtra("title", x.optString("title"));
            i.putExtra("text", x.optString("text"));
            i.putExtra("open", x.optString("open"));
        }
        return PendingIntent.getBroadcast(c, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void canales(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel a = new NotificationChannel(AVISOS, "Recordatorios", NotificationManager.IMPORTANCE_HIGH);
        a.setDescription("Tareas que vencen, maleta, hora de salir y de dormir");
        nm.createNotificationChannel(a);
        NotificationChannel b = new NotificationChannel(ALARMAS, "Alarmas", NotificationManager.IMPORTANCE_HIGH);
        b.setDescription("Despertador con tu canción");
        b.setSound(null, null); // la canción la pone la pantalla de alarma
        b.setBypassDnd(true);
        b.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(b);
    }

    static PendingIntent abrir(Context c, String open, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Store.abrir(open), c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void notificar(Context c, int code, String title, String text, String open) {
        canales(c);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, AVISOS) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(title).setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setColor(0xFFE88AA8).setAutoCancel(true).setContentIntent(abrir(c, open, code));
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        try { c.getSystemService(NotificationManager.class).notify(code, b.build()); } catch (SecurityException ignored) { }
    }

    @Override
    public void onReceive(Context c, Intent i) {
        String id = i.getStringExtra("id");
        if (id == null) return;
        String title = i.getStringExtra("title"), text = i.getStringExtra("text"), open = i.getStringExtra("open");
        if ("alarm".equals(i.getStringExtra("kind"))) Alarma.sonar(c, id, title, text, open);
        else notificar(c, id.hashCode(), title, text, open);
    }
}
