/* ==========================================
   TRADING PLATFORM - Push Notification Setup
   Auth Session Version
   ========================================== */

(() => {
  "use strict";

  const SUPABASE_URL =
    "https://cyvquivolvkxzcseyhvk.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_dy2_qtfTrOjeD-kPKohHiQ_zKHxZEHU";

  const VAPID_PUBLIC_KEY =
    "BOXaxepmxxCsjuRQ5tXvuItEseHSEVTQfWUwukno2t7NEOpArEgJVXU9DeEctMYSBVXpJDMJSt5vID92celXiWM";


  /* ==========================================
     Get current customer UID
     ========================================== */

  function getUid() {
    const uid =
      localStorage.getItem("demoCustomerUid") ||
      localStorage.getItem("demoUid") ||
      "";

    return /^DEMO-\d{6}$/.test(uid)
      ? uid
      : null;
  }


  /* ==========================================
     Get current Supabase Auth access token
     ========================================== */

  async function getAccessToken() {

    /*
     * trading.html already creates:
     *
     * window.customerAuth = {
     *   client,
     *   user,
     *   profile
     * }
     *
     * We reuse that authenticated Supabase client.
     */

    if (
      window.__customerAuthReady &&
      typeof window.__customerAuthReady.then === "function"
    ) {
      try {
        await window.__customerAuthReady;
      } catch (e) {
        console.warn(
          "[Push] customer auth ready failed:",
          e
        );
      }
    }

    const authClient =
      window.customerAuth?.client;

    if (!authClient) {
      throw new Error(
        "Customer authentication is not ready"
      );
    }

    const {
      data,
      error
    } = await authClient.auth.getSession();

    if (error) {
      throw error;
    }

    const accessToken =
      data?.session?.access_token;

    if (!accessToken) {
      throw new Error(
        "Customer login session not found"
      );
    }

    return accessToken;
  }


  /* ==========================================
     Convert VAPID public key
     ========================================== */

  function urlBase64ToUint8Array(
    base64String
  ) {

    const padding =
      "=".repeat(
        (4 - (base64String.length % 4)) % 4
      );

    const base64 =
      (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData =
      window.atob(base64);

    return Uint8Array.from(
      [...rawData].map(
        char => char.charCodeAt(0)
      )
    );
  }


  /* ==========================================
     Save subscription to Supabase
     ========================================== */

  async function saveSubscription(
    uid,
    subscription
  ) {

    const json =
      subscription.toJSON();

    const p256dh =
      json.keys?.p256dh;

    const auth =
      json.keys?.auth;

    if (!p256dh || !auth) {
      throw new Error(
        "Push subscription keys are missing"
      );
    }


    /*
     * IMPORTANT:
     * Use customer's real Supabase Auth JWT.
     */

    const accessToken =
      await getAccessToken();


    const response =
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`,
        {
          method: "POST",

          headers: {
            apikey: SUPABASE_KEY,

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

            Prefer:
              "resolution=merge-duplicates,return=minimal"
          },

          body: JSON.stringify({
            uid,
            endpoint:
              subscription.endpoint,
            p256dh,
            auth,
            updated_at:
              new Date().toISOString()
          })
        }
      );


    if (!response.ok) {

      const text =
        await response.text();

      throw new Error(
        `Supabase save failed: ${response.status} ${text}`
      );
    }
  }


  /* ==========================================
     Enable Push Notifications
     ========================================== */

  async function enablePushNotifications() {

    try {

      const uid =
        getUid();

      if (!uid) {
        throw new Error(
          "Customer UID not found"
        );
      }


      /* Make sure login session exists first */

      await getAccessToken();


      /* Browser support */

      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        throw new Error(
          "This browser does not support Web Push"
        );
      }


      /* Register Service Worker */

      const registration =
        await navigator
          .serviceWorker
          .register("./sw.js");


      await navigator
        .serviceWorker
        .ready;


      /* Notification permission */

      let permission =
        Notification.permission;


      if (permission === "default") {

        permission =
          await Notification
            .requestPermission();
      }


      if (permission !== "granted") {

        throw new Error(
          "Notification permission was not granted"
        );
      }


      /* Check existing subscription */

      let subscription =
        await registration
          .pushManager
          .getSubscription();


      /* Create subscription */

      if (!subscription) {

        subscription =
          await registration
            .pushManager
            .subscribe({

              userVisibleOnly: true,

              applicationServerKey:
                urlBase64ToUint8Array(
                  VAPID_PUBLIC_KEY
                )
            });
      }


      /* Save to Supabase */

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


  /* ==========================================
     Sync existing subscription
     ========================================== */

  async function syncExistingSubscription() {

    try {

      const uid =
        getUid();

      if (!uid) {
        return;
      }


      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        return;
      }


      /*
       * Make sure customer is still logged in.
       */

      await getAccessToken();


      const registration =
        await navigator
          .serviceWorker
          .register("./sw.js");


      await navigator
        .serviceWorker
        .ready;


      const subscription =
        await registration
          .pushManager
          .getSubscription();


      /*
       * Don't create a new subscription
       * automatically.
       */

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
        "[Push] existing subscription synced:",
        uid
      );


    } catch (error) {

      console.error(
        "[Push] sync failed:",
        error
      );
    }
  }


  /* ==========================================
     Public API
     ========================================== */

  window.DemoPushNotifications = {

    enable:
      enablePushNotifications,

    sync:
      syncExistingSubscription,


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


  /* ==========================================
     Page load
     ========================================== */

  window.addEventListener(
    "load",
    () => {

      /*
       * Only sync an existing subscription.
       *
       * Never automatically display the
       * notification permission popup.
       */

      syncExistingSubscription();
    }
  );

})();
