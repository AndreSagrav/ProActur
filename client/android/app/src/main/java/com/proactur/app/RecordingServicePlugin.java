package com.proactur.app;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RecordingService")
public class RecordingServicePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        String title = call.getString("title", "Grabando sesión en vivo");
        try {
            Intent serviceIntent = new Intent(getContext(), RecordingForegroundService.class);
            serviceIntent.putExtra(RecordingForegroundService.EXTRA_TITLE, title);
            ContextCompat.startForegroundService(getContext(), serviceIntent);
            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("No se pudo iniciar servicio en primer plano: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), RecordingForegroundService.class);
            getContext().stopService(serviceIntent);
            JSObject ret = new JSObject();
            ret.put("stopped", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("No se pudo detener servicio: " + e.getMessage());
        }
    }
}
