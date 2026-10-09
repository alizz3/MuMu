package co.alizz.mumu;

import android.net.Uri;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * Abre MuMu (la misma de la web) a pantalla completa y le pasa en el enlace
 * el resumen de uso del celular de los últimos días. Nada sale del celular
 * salvo hacia tu propia MuMu.
 */
public class MainActivity extends LauncherActivity {
    @Override
    protected Uri getLaunchingUrl() {
        Uri base = super.getLaunchingUrl();
        if (base == null || base.getEncodedFragment() != null) return base;
        try {
            return base.buildUpon().encodedFragment("uso=" + Uso.resumen(this, 7)).build();
        } catch (Exception e) {
            return base;
        }
    }
}
