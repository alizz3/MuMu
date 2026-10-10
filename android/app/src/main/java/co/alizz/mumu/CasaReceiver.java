package co.alizz.mumu;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;

import java.util.Calendar;

/** Llegaste a la casa: MuMu te pregunta qué hacemos por tu vida (máximo una vez cada 3 horas). */
public class CasaReceiver extends BroadcastReceiver {
    private static final String[] FRASES = {
        "¿Qué estás haciendo? Hagamos algo por tu vida: 25 minutos de lo que más importa.",
        "Bienvenida. Toma agua, respira y elige una cosita para avanzar.",
        "Llegaste. ¿Un rato de enfoque, un hábito o tiempo en familia?",
    };

    @Override
    public void onReceive(Context c, Intent i) {
        if (!i.getBooleanExtra(LocationManager.KEY_PROXIMITY_ENTERING, false)) return;
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (h < 9 || h >= 22) return;
        long last = Store.p(c).getLong("casaAt", 0);
        if (System.currentTimeMillis() - last < 3 * 3600 * 1000L) return;
        Store.p(c).edit().putLong("casaAt", System.currentTimeMillis()).apply();
        Aviso.notificar(c, 777, "Ya estás en casa", FRASES[(int) (System.currentTimeMillis() / 60000 % FRASES.length)], "casa=llegue");
    }
}
