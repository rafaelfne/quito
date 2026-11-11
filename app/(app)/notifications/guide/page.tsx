"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GuideView } from "@/app/(app)/notifications/guide/guide-view";
import { installStatusOf, requestPushTest, testStatusFrom, type InstallPromptEvent, type TestStatus } from "@/lib/activation-guide";
import { guideLinkFrom } from "@/lib/guide-qr";
import { browserPushEnvironment, checkPush, currentEndpoint, deviceFrom, enablePush, type PushDevice, type PushStatus } from "@/lib/push-subscription";
import { supabase } from "@/lib/supabase";

export default function NotificationsGuidePage() {
  const arrivedFromTest = testStatusFrom(useSearchParams().get("from"));
  const [device, setDevice] = useState<PushDevice | null>(null);
  const [guideLink, setGuideLink] = useState("");
  const [standalone, setStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [push, setPush] = useState<PushStatus>("checking");
  const [enabling, setEnabling] = useState(false);
  const [test, setTest] = useState<TestStatus>(arrivedFromTest);

  useEffect(() => {
    const environment = browserPushEnvironment(window);
    void checkPush(environment, supabase).then((status) => {
      setDevice(deviceFrom(environment.userAgent));
      setGuideLink(guideLinkFrom(window.location.origin));
      setStandalone((installed) => installed || environment.standalone);
      setPush(status);
    });
    const offerInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const installed = () => {
      setStandalone(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", offerInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", offerInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (outcome === "accepted") setStandalone(true);
  }

  async function enable() {
    setEnabling(true);
    setPush(await enablePush(browserPushEnvironment(window), supabase, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""));
    setEnabling(false);
  }

  async function recheck() {
    setPush("checking");
    setPush(await checkPush(browserPushEnvironment(window), supabase));
  }

  async function sendTest() {
    setTest("sending");
    const [{ data }, endpoint] = await Promise.all([supabase.auth.getSession(), currentEndpoint(browserPushEnvironment(window))]);
    const result = await requestPushTest(fetch, data.session?.access_token ?? null, endpoint);
    setTest(result);
    if (result === "gone") setPush("off");
  }

  return (
    <GuideView
      device={device}
      guideLink={guideLink}
      install={installStatusOf(standalone, installPrompt)}
      push={push}
      test={test}
      enabling={enabling}
      onInstall={() => void install()}
      onEnable={() => void enable()}
      onRecheck={() => void recheck()}
      onSendTest={() => void sendTest()}
      onArrived={() => setTest("arrived")}
      onNotArrived={() => setTest("not-arrived")}
    />
  );
}
