package com.shadowbeat.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.Locale;

/**
 * Shadow Beat — an English shadowing/rhythm game that runs as one HTML page
 * in a WebView. This activity supplies the four things a web page cannot do
 * on its own: British-English text-to-speech, microphone permission, and
 * real AdMob banner / interstitial / rewarded (rescue) ads.
 *
 * The page calls Android.speak / setBanner / showInterstitial / showRewarded;
 * this class answers with window.onSpeakDone / onAdRewarded / onAdClosed / onAdFailed.
 */
public class MainActivity extends AppCompatActivity {

    private static final int MIC_PERMISSION_REQUEST = 1001;

    private WebView web;
    private FrameLayout bannerHolder;
    private AdView banner;
    private InterstitialAd interstitial;
    private RewardedAd rewarded;
    private ConsentInformation consent;
    private boolean adsReady = false;
    private boolean adsStarted = false;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        web = findViewById(R.id.web);
        bannerHolder = findViewById(R.id.bannerHolder);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);              // the game saves progress in localStorage
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);                        // ignore the system font-size setting

        // The page is served from a real https origin rather than file://, so the
        // player's progress in localStorage survives updates and restarts.
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
        });

        // The page uses getUserMedia() to read microphone loudness for beat scoring.
        // WebView permission prompts are separate from the Android runtime permission,
        // so both must be granted before audio capture works.
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    for (String res : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                            if (hasMicPermission()) {
                                request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                            } else {
                                request.deny();
                            }
                            return;
                        }
                    }
                    request.deny();
                });
            }
        });

        web.setBackgroundColor(0xFF0D0B1A);
        web.addJavascriptInterface(new JsBridge(), "Android");
        web.loadUrl("https://appassets.androidplatform.net/assets/www/shadow-beat.html");

        initTts();
        startConsentThenAds();
    }

    /* ---------------- microphone permission ---------------- */

    private boolean hasMicPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void requestMicPermissionIfNeeded() {
        if (!hasMicPermission()) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.RECORD_AUDIO}, MIC_PERMISSION_REQUEST);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                            @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MIC_PERMISSION_REQUEST) {
            boolean granted = hasMicPermission();
            toPage("window.onMicPermissionResult && window.onMicPermissionResult(" + granted + ")");
        }
    }

    /* ---------------- text-to-speech (British English) ---------------- */

    private void initTts() {
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = tts.setLanguage(Locale.UK);
                ttsReady = result != TextToSpeech.LANG_MISSING_DATA
                        && result != TextToSpeech.LANG_NOT_SUPPORTED;
                pickBestVoice();
                tts.setSpeechRate(0.92f); // slightly slower helps clarity for learners
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String utteranceId) { }
                    @Override public void onDone(String utteranceId) {
                        toPage("window.onSpeakDone && window.onSpeakDone('" + esc(utteranceId) + "')");
                    }
                    @Override public void onError(String utteranceId) {
                        toPage("window.onSpeakDone && window.onSpeakDone('" + esc(utteranceId) + "')");
                    }
                    @Override public void onRangeStart(String utteranceId, int start, int end, int frame) {
                        toPage("window.onSpeakRange && window.onSpeakRange('" + esc(utteranceId)
                                + "'," + start + "," + end + ")");
                    }
                });
            }
        });
    }

    /** Picks the most natural-sounding installed en-GB voice available.
     *  Many devices ship several: a small robotic one plus higher-quality
     *  ones (some network-based). We prefer the highest declared quality,
     *  and among ties prefer a voice that doesn't require a network
     *  connection so speech still works offline. A voice the player picked
     *  manually in Settings always wins over the automatic choice. */
    private void pickBestVoice() {
        if (tts == null) return;
        String saved = getSharedPreferences("tts", MODE_PRIVATE).getString("voice_name", null);
        if (saved != null) {
            for (android.speech.tts.Voice v : tts.getVoices()) {
                if (v.getName().equals(saved)) { tts.setVoice(v); return; }
            }
        }
        try {
            android.speech.tts.Voice best = null;
            for (android.speech.tts.Voice v : tts.getVoices()) {
                if (v.getLocale() == null || !"GBR".equals(v.getLocale().getISO3Country())
                        && !"GB".equalsIgnoreCase(v.getLocale().getCountry())) continue;
                if (v.isNetworkConnectionRequired() && best != null && !best.isNetworkConnectionRequired()
                        && best.getQuality() >= v.getQuality()) continue;
                if (best == null || v.getQuality() > best.getQuality()) best = v;
            }
            if (best != null) tts.setVoice(best);
        } catch (Exception e) {
            // if voice enumeration fails on this device, just keep the default
        }
    }

    /** en-GB voices on this device, as a JSON array the page can render as a picker:
     *  [{"name":"...", "quality":"高音質"/"標準", "network":true/false, "current":true/false}, ...] */
    private String voicesAsJson() {
        StringBuilder sb = new StringBuilder("[");
        if (tts != null) {
            android.speech.tts.Voice current = tts.getVoice();
            boolean first = true;
            for (android.speech.tts.Voice v : tts.getVoices()) {
                if (v.getLocale() == null) continue;
                boolean isGb = "GBR".equals(v.getLocale().getISO3Country())
                        || "GB".equalsIgnoreCase(v.getLocale().getCountry());
                if (!isGb) continue;
                String quality = v.getQuality() >= android.speech.tts.Voice.QUALITY_HIGH
                        ? "高音質" : v.getQuality() >= android.speech.tts.Voice.QUALITY_NORMAL
                        ? "標準" : "低音質";
                if (!first) sb.append(",");
                first = false;
                sb.append("{\"name\":\"").append(esc(v.getName())).append("\",")
                  .append("\"quality\":\"").append(quality).append("\",")
                  .append("\"network\":").append(v.isNetworkConnectionRequired()).append(",")
                  .append("\"current\":").append(current != null && current.getName().equals(v.getName()))
                  .append("}");
            }
        }
        sb.append("]");
        return sb.toString();
    }

    /* ---------------- consent (required wherever GDPR/UK GDPR applies) ----------------
       Google's User Messaging Platform decides whether a form is needed from the
       player's region, shows it, and only then may ads be requested. Outside those
       regions it resolves immediately and nothing is shown. */
    private void startConsentThenAds() {
        consent = UserMessagingPlatform.getConsentInformation(this);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consent.requestConsentInfoUpdate(this, params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, formError -> initAds()),
                requestError -> initAds());
        if (consent.canRequestAds()) initAds();
    }

    private void initAds() {
        if (adsStarted) return;
        if (consent != null && !consent.canRequestAds()) return;
        adsStarted = true;
        MobileAds.initialize(this, initializationStatus -> {
            adsReady = true;
            loadInterstitial();
            loadRewarded();
        });
    }

    /* ---------------- the page's side of the bridge ---------------- */

    public class JsBridge {
        @JavascriptInterface
        public void speak(final String text, final String utteranceId) {
            runOnUiThread(() -> {
                if (ttsReady && tts != null) {
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId);
                } else {
                    toPage("window.onSpeakDone && window.onSpeakDone('" + esc(utteranceId) + "')");
                }
            });
        }

        @JavascriptInterface
        public void setBanner(final boolean show) {
            runOnUiThread(() -> {
                if (show) showBanner();
                else hideBanner();
            });
        }

        @JavascriptInterface
        public void showInterstitial(final String tag) {
            runOnUiThread(() -> presentInterstitial(tag));
        }

        @JavascriptInterface
        public void showRewarded(final String tag) {
            runOnUiThread(() -> presentRewarded(tag));
        }

        @JavascriptInterface
        public boolean hasMicPermissionSync() {
            return hasMicPermission();
        }

        @JavascriptInterface
        public void requestMicPermission() {
            runOnUiThread(() -> {
                if (hasMicPermission()) {
                    toPage("window.onMicPermissionResult && window.onMicPermissionResult(true)");
                } else {
                    ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.RECORD_AUDIO}, MIC_PERMISSION_REQUEST);
                }
            });
        }

        @JavascriptInterface
        public String listVoices() {
            return voicesAsJson();
        }

        @JavascriptInterface
        public void setVoiceByName(final String name) {
            runOnUiThread(() -> {
                if (tts == null) return;
                for (android.speech.tts.Voice v : tts.getVoices()) {
                    if (v.getName().equals(name)) {
                        tts.setVoice(v);
                        getSharedPreferences("tts", MODE_PRIVATE).edit()
                                .putString("voice_name", name).apply();
                        break;
                    }
                }
            });
        }

        @JavascriptInterface
        public void openVoiceDownload() {
            runOnUiThread(() -> {
                try {
                    android.content.Intent intent =
                            new android.content.Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
                    startActivity(intent);
                } catch (Exception e) {
                    // no TTS engine settings screen available on this device
                }
            });
        }

        @JavascriptInterface
        public boolean startMicNative() {
            return startNativeMicCapture();
        }

        @JavascriptInterface
        public void stopMicNative() {
            stopNativeMicCapture();
        }
    }

    private void toPage(final String js) {
        runOnUiThread(() -> web.evaluateJavascript(js, (ValueCallback<String>) null));
    }

    /* ---------------- banner ---------------- */

    private void showBanner() {
        if (banner != null) return;
        banner = new AdView(this);
        banner.setAdUnitId(getString(R.string.admob_banner_id));
        banner.setAdSize(adaptiveSize());
        bannerHolder.addView(banner, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        banner.loadAd(new AdRequest.Builder().build());
    }

    private void hideBanner() {
        if (banner == null) return;
        bannerHolder.removeAllViews();
        banner.destroy();
        banner = null;
    }

    private AdSize adaptiveSize() {
        float density = getResources().getDisplayMetrics().density;
        int widthDp = Math.round(getResources().getDisplayMetrics().widthPixels / density);
        return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(this, widthDp);
    }

    /* ---------------- interstitial: shown once, when a stage set unlocks ---------------- */

    private void loadInterstitial() {
        InterstitialAd.load(this, getString(R.string.admob_interstitial_id),
                new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override public void onAdLoaded(@NonNull InterstitialAd ad) { interstitial = ad; }
                    @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { interstitial = null; }
                });
    }

    private void presentInterstitial(final String tag) {
        if (!adsReady || interstitial == null) {
            toPage("window.onAdFailed && window.onAdFailed('" + esc(tag) + "')");
            loadInterstitial();
            return;
        }
        interstitial.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() {
                interstitial = null; loadInterstitial();
                toPage("window.onAdClosed && window.onAdClosed('" + esc(tag) + "')");
            }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) {
                interstitial = null; loadInterstitial();
                toPage("window.onAdFailed && window.onAdFailed('" + esc(tag) + "')");
            }
        });
        interstitial.show(this);
    }

    /* ---------------- rewarded: the "rescue" retry after 3 failed attempts ---------------- */

    private void loadRewarded() {
        RewardedAd.load(this, getString(R.string.admob_rewarded_id),
                new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override public void onAdLoaded(@NonNull RewardedAd ad) { rewarded = ad; }
                    @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { rewarded = null; }
                });
    }

    private void presentRewarded(final String tag) {
        if (!adsReady || rewarded == null) {
            toPage("window.onAdFailed && window.onAdFailed('" + esc(tag) + "')");
            loadRewarded();
            return;
        }
        rewarded.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() {
                rewarded = null; loadRewarded();
                toPage("window.onAdClosed && window.onAdClosed('" + esc(tag) + "')");
            }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) {
                rewarded = null; loadRewarded();
                toPage("window.onAdFailed && window.onAdFailed('" + esc(tag) + "')");
            }
        });
        rewarded.show(this, reward ->
                toPage("window.onAdRewarded && window.onAdRewarded('" + esc(tag) + "')"));
    }

    private static String esc(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("'", "\\'");
    }

    /* ---------------- native mic capture (bypasses WebView getUserMedia) ----------------
       Some Android WebView builds fail getUserMedia audio with NotReadableError even
       with a permission granted and no other app using the mic. Reading the microphone
       directly with AudioRecord sidesteps that WebView audio-capture pipeline entirely;
       we push a volume (RMS) reading to the page a few dozen times a second instead. */

    private static final int MIC_SAMPLE_RATE = 16000;
    private android.media.AudioRecord audioRecord;
    private Thread micThread;
    private volatile boolean micRunning = false;

    private boolean startNativeMicCapture() {
        if (!hasMicPermission()) return false;
        if (micRunning) return true;
        try {
            int minBuf = android.media.AudioRecord.getMinBufferSize(MIC_SAMPLE_RATE,
                    android.media.AudioFormat.CHANNEL_IN_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT);
            if (minBuf <= 0) return false;
            audioRecord = new android.media.AudioRecord(android.media.MediaRecorder.AudioSource.MIC,
                    MIC_SAMPLE_RATE, android.media.AudioFormat.CHANNEL_IN_MONO,
                    android.media.AudioFormat.ENCODING_PCM_16BIT, minBuf * 2);
            if (audioRecord.getState() != android.media.AudioRecord.STATE_INITIALIZED) {
                audioRecord.release();
                audioRecord = null;
                return false;
            }
            audioRecord.startRecording();
            micRunning = true;
            final short[] buffer = new short[Math.max(256, minBuf / 2)];
            micThread = new Thread(() -> {
                while (micRunning) {
                    android.media.AudioRecord ar = audioRecord;
                    if (ar == null) break;
                    int n = ar.read(buffer, 0, buffer.length);
                    if (n > 0) {
                        double sum = 0;
                        for (int i = 0; i < n; i++) {
                            double v = buffer[i] / 32768.0;
                            sum += v * v;
                        }
                        final double rms = Math.sqrt(sum / n);
                        toPage("window.onMicAmplitude && window.onMicAmplitude(" + rms + ")");
                    }
                    try { Thread.sleep(30); } catch (InterruptedException ignored) { }
                }
            });
            micThread.start();
            return true;
        } catch (Exception e) {
            micRunning = false;
            if (audioRecord != null) { audioRecord.release(); audioRecord = null; }
            return false;
        }
    }

    private void stopNativeMicCapture() {
        micRunning = false;
        if (micThread != null) {
            try { micThread.join(200); } catch (InterruptedException ignored) { }
            micThread = null;
        }
        if (audioRecord != null) {
            try { audioRecord.stop(); } catch (Exception ignored) { }
            audioRecord.release();
            audioRecord = null;
        }
    }

    /* ---------------- lifecycle ---------------- */

    @Override protected void onPause() {
        if (banner != null) banner.pause();
        stopNativeMicCapture();
        web.onPause();
        web.pauseTimers();
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        web.resumeTimers();
        web.onResume();
        if (banner != null) banner.resume();
    }

    @Override protected void onDestroy() {
        if (banner != null) banner.destroy();
        stopNativeMicCapture();
        if (tts != null) { tts.stop(); tts.shutdown(); }
        super.onDestroy();
    }

    /** Back goes through the game's own screens first, and only then leaves. */
    @Override public void onBackPressed() {
        web.evaluateJavascript(
                "(function(){ try{ return window.onBackPressed ? !!window.onBackPressed() : false; }catch(e){ return false; } })()",
                value -> {
                    if (!"true".equals(value)) finish();
                });
    }
}
