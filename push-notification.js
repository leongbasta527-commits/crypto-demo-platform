/* ==========================================
   TRADING PLATFORM - Push Notification Setup
   ========================================== */

(() => {
  "use strict";

  const SUPABASE_URL =
    "https://cyvquivolvkxzcseyhvk.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_dy2_qtfTrOjeD-kPKohHiQ_zKHxZEHU";

  const VAPID_PUBLIC_KEY =
    "BOXaxepmxxCsjuRQ5tXvuItEseHSEVTQfWUwukno2t7NEOpArEgJVXU9DeEctMYSBVXpJDMJSt5vID92celXiWM";

  function getUid() {
    const uid =
      localStorage.getItem("demoCustomerUid") ||
      localStorage.getItem("demoUid") ||
      "";

    return /^DEMO-\d{6}$/.test(uid)
      ? uid
      : null;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding =
      "=".repeat((4 - (base64String.length % 4)) % 4);

    const base64 =
      (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);

    return Uint8Array.from(
      [...rawData].map(char =>
        char.charCodeAt(0)
      )
    );
  }

  async function saveSubscription(uid, subscription) {
    const json = subscription.toJSON();

    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;

    if (!p256dh || !auth) {
      throw new Error(
        "Push subscription keys are missing"
      );
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`,
      {
        method: "POST",

        headers: {
          apikey: SUPABASE_KEY,
          Authorization:
            `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer:
            "resolution=merge-duplicates,return=minimal"
        },

        body: JSON.stringify({
          uid,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          updated_at:
            new Date().toISOString()
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();

      throw new Error(
        `Supabase save failed: ${response.status} ${text}`
      );
    }
  }

  async function enablePushNotifications() {
    try {
      const uid = getUid();

      if (!uid) {
        throw new Error(
          "Customer UID not found"
        );
      }

      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        throw new Error(
          "This browser does not support Web Push"
        );
      }

      /*
       * sw.js is in the same GitHub Pages
       * project root as the HTML pages.
       */
      const registration =
        await navigator.serviceWorker.register(
          "./sw.js"
        );

      await navigator.serviceWorker.ready;

      let permission =
        Notification.permission;

      if (permission === "default") {
        permission =
          await Notification.requestPermission();
      }

      if (permission !== "granted") {
        throw new Error(
          "Notification permission was not granted"
        );
      }

      let subscription =
        await registration.pushManager
          .getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,

            applicationServerKey:
              urlBase64ToUint8Array(
                VAPID_PUBLIC_KEY
              )
          });
      }

      await saveSubscription(
        uid,
        subscription
      );

      localStorage.setItem(
        "demoPushEnabled",
        "1"
      );

      console.log(
        "[Push] subscription saved:",
        uid
      );

      return {
        success: true,
        uid,
        subscription
      };
    } catch (error) {
      console.error(
        "[Push] enable failed:",
        error
      );

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      };
    }
  }

  async function syncExistingSubscription() {
    try {
      const uid = getUid();

      if (!uid) return;

      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        return;
      }

      const registration =
        await navigator.serviceWorker.register(
          "./sw.js"
        );

      await navigator.serviceWorker.ready;

      const subscription =
        await registration.pushManager
          .getSubscription();

      if (!subscription) {
        return;
      }

      await saveSubscription(
        uid,
        subscription
      );

      localStorage.setItem(
        "demoPushEnabled",
        "1"
      );

      console.log(
        "[Push] existing subscription synced"
      );
    } catch (error) {
      console.error(
        "[Push] sync failed:",
        error
      );
    }
  }

  window.DemoPushNotifications = {
    enable: enablePushNotifications,
    sync: syncExistingSubscription,

    get status() {
      return {
        supported:
          "serviceWorker" in navigator &&
          "PushManager" in window &&
          "Notification" in window,

        permission:
          "Notification" in window
            ? Notification.permission
            : "unsupported",

        enabled:
          localStorage.getItem(
            "demoPushEnabled"
          ) === "1"
      };
    }
  };

  /*
   * Only sync an EXISTING subscription here.
   * We intentionally do not automatically
   * display the browser permission popup.
   */
  window.addEventListener(
    "load",
    () => {
      syncExistingSubscription();
    }
  );
})();
