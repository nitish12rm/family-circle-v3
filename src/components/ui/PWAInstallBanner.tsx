"use client";
import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";

type Platform = "ios" | "android";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };

const STORAGE_KEY = "pwa-install-dismissed";

export default function PWAInstallBanner() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Don't show if already running as installed PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Don't show if user already dismissed
    if (localStorage.getItem(STORAGE_KEY)) return;

    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isAndroid = /Android/.test(ua);

    if (isIOS) {
      setPlatform("ios");
      setVisible(true);
    } else if (isAndroid) {
      setPlatform("android");
      // Show for Android only once beforeinstallprompt fires
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setVisible(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  const handleInstallAndroid = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") dismiss();
    setInstalling(false);
  };

  if (!visible || !platform) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[70] flex justify-center px-0 pb-0 pointer-events-none">
      <div
        className="w-full max-w-xl bg-bg border-t border-border rounded-t-3xl shadow-2xl pointer-events-auto animate-slide-up"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-2 pb-3">
          <AppLogo size={28} containerSize={48} />
          <div className="flex-1">
            <p className="text-sm font-bold text-text">Install Family Circle</p>
            <p className="text-xs text-text-faint mt-0.5">Add to your home screen for the best experience</p>
          </div>
          <button onClick={dismiss} className="p-1.5 text-text-faint hover:text-text transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Steps */}
        <div className="px-5 pb-2">
          {platform === "ios" ? (
            <div className="bg-bg-2 rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">How to install on iOS</p>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-accent text-xs font-bold">1</span>
                </div>
                <div>
                  <p className="text-sm text-text font-medium">Tap the Share button</p>
                  <p className="text-xs text-text-faint mt-0.5">
                    Tap{" "}
                    <span className="inline-flex items-center gap-0.5 bg-bg-3 border border-border rounded px-1.5 py-0.5 text-[11px] font-medium text-text">
                      <ShareIcon /> Share
                    </span>{" "}
                    at the bottom of Safari
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-accent text-xs font-bold">2</span>
                </div>
                <div>
                  <p className="text-sm text-text font-medium">Add to Home Screen</p>
                  <p className="text-xs text-text-faint mt-0.5">
                    Scroll down and tap{" "}
                    <span className="inline-flex items-center gap-0.5 bg-bg-3 border border-border rounded px-1.5 py-0.5 text-[11px] font-medium text-text">
                      <PlusBoxIcon /> Add to Home Screen
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-accent text-xs font-bold">3</span>
                </div>
                <div>
                  <p className="text-sm text-text font-medium">Tap "Add" to confirm</p>
                  <p className="text-xs text-text-faint mt-0.5">Family Circle will appear on your home screen</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-bg-2 rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Install on Android</p>
              <p className="text-sm text-text-faint">
                Tap <span className="font-medium text-text">Install App</span> below to add Family Circle to your home screen and get the full app experience — no app store needed.
              </p>
            </div>
          )}
        </div>

        {/* Action */}
        <div className="px-5 pb-4 pt-1">
          {platform === "ios" ? (
            <button
              onClick={dismiss}
              className="w-full py-3 rounded-2xl bg-bg-2 border border-border text-sm font-medium text-text-muted hover:bg-bg-3 transition-colors"
            >
              Got it
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={dismiss}
                className="flex-1 py-3 rounded-2xl border border-border text-sm text-text-muted hover:bg-bg-2 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={handleInstallAndroid}
                disabled={installing}
                className="flex-1 py-3 rounded-2xl bg-accent text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <Download size={15} />
                Install App
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline SVG icons that match iOS/Android visuals
function ShareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function PlusBoxIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
