# Ride Angels — release R8 / ProGuard
# Capacitor + Cordova plugin reflection must survive minify.

-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile

# Capacitor v3+ plugins
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep public class * extends com.getcapacitor.Plugin { *; }

# Capacitor v2 (deprecated annotations still present in some plugins)
-keep @com.getcapacitor.NativePlugin public class * {
    @com.getcapacitor.PluginMethod public <methods>;
}

# Cordova bridge plugins
-keep public class * extends org.apache.cordova.** {
    public <methods>;
    public <fields>;
}

# Keep Capacitor bridge / JS interface surface
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# Push / FCM (when google-services is applied)
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Capgo calendar / other Cap plugins use reflection on plugin classes
-keep class ee.forgr.capacitor_plugins.** { *; }
-keep class com.capgo.** { *; }
-keep class io.capawesome.** { *; }
-dontwarn ee.forgr.**
-dontwarn com.capgo.**
-dontwarn io.capawesome.**
