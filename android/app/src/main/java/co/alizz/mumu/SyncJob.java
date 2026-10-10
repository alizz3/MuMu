package co.alizz.mumu;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Cada ~30 min: trae el plan de MuMu y sube el uso del celular. */
public class SyncJob extends JobService {
    @Override
    public boolean onStartJob(JobParameters p) {
        new Thread(() -> {
            boolean otraVez = false;
            try { Sync.ahora(getApplicationContext()); } catch (Exception e) { otraVez = true; }
            jobFinished(p, otraVez);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters p) { return true; }
}
