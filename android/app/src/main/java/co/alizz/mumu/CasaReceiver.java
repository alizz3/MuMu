package co.alizz.mumu;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

/**
 * Llegaste o saliste de tu casa: se guarda aquí y en MuMu. Al llegar, MuMu te pregunta qué hacemos
 * por tu vida y te dice lo que no te recordó mientras estabas fuera (máximo un aviso cada 3 horas).
 */
public class CasaReceiver extends BroadcastReceiver {
    private static final String[] FRASES = {
        "¿Qué estás haciendo? Hagamos algo por tu vida: 25 minutos de lo que más importa.",
        "Bienvenida. Toma agua, respira y elige una cosita para avanzar.",
        "Llegaste. ¿Un rato de enfoque, un hábito o tiempo en familia?",
    };

    @Override
    public void onReceive(Context c, Intent i) {
        if (!i.hasExtra(LocationManager.KEY_PROXIMITY_ENTERING)) return;
        boolean llega = i.getBooleanExtra(LocationManager.KEY_PROXIMITY_ENTERING, false);
        Store.p(c).edit().putBoolean("enCasa", llega).putLong("casaCambio", System.currentTimeMillis()).apply();
        PendingResult r = goAsync();
        new Thread(() -> {
            try {
                if (Store.token(c) != null) Sync.http(c, "POST", "/api/device/casa", new JSONObject().put("home", llega).toString());
            } catch (Exception ignored) { }
            r.finish();
        }).start();
        if (!llega) return;
        Set<String> pend = new HashSet<>(Store.p(c).getStringSet("pendientes", new HashSet<>()));
        Store.p(c).edit().remove("pendientes").apply();
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        long last = Store.p(c).getLong("casaAt", 0);
        if (pend.isEmpty() && (h < 9 || h >= 22 || System.currentTimeMillis() - last < 3 * 3600 * 1000L)) return;
        Store.p(c).edit().putLong("casaAt", System.currentTimeMillis()).apply();
        String txt = FRASES[(int) (System.currentTimeMillis() / 60000 % FRASES.length)];
        if (!pend.isEmpty()) txt = "Mientras estabas fuera: " + String.join(" · ", pend) + ". " + txt;
        Aviso.notificar(c, 777, "Ya estás en casa", txt, "casa=llegue");
    }
}
