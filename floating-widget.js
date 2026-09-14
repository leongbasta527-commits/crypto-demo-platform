(function () {
  "use strict";

  if (document.getElementById("demoFloatingWidget")) return;

  const SUPABASE_URL =
    "https://cyvquivolvkxzcseyhvk.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_dy2_qtfTrOjeD-kPKohHiQ_zKHxZEHU";

  const SUPPORT_URL =
    "https://t.me/Kath02210";

  const SUPPORT_HANDLE =
    "@Kath02210";

  const POS_KEY =
    "demoFloatingWidgetPosition";

  const NOTIFY_SEEN_KEY =
    "demoNotificationLastSeenId";

  /* =========================
     CSS
  ========================= */

  const css = `
  #demoFloatingWidget {
    position: fixed;
    z-index: 99990;
    left: calc(100vw - 34px);
    top: 42%;
    font-family: Arial, sans-serif;
    touch-action: none;
    user-select: none;
  }

  #demoFloatingWidget * {
    box-sizing: border-box;
  }

  .dfw-handle {
    width: 34px;
    height: 46px;
    border: 1px solid #2a3440;
    border-radius: 14px 0 0 14px;
    background: rgba(17,24,33,.96);
    box-shadow: 0 6px 22px rgba(0,0,0,.32);
    display: grid;
    place-items: center;
    color: #9aa7b7;
    cursor: pointer;
    backdrop-filter: blur(10px);
  }

  .dfw-handle svg {
    width: 17px;
    height: 17px;
    transition: transform .2s;
  }

  #demoFloatingWidget.open .dfw-handle svg {
    transform: rotate(180deg);
  }

  .dfw-tools {
    position: absolute;
    right: 39px;
    top: 50%;
    transform: translateY(-50%) scale(.92);
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 7px;
    border: 1px solid #26313d;
    border-radius: 14px;
    background: rgba(13,19,27,.97);
    box-shadow: 0 10px 30px rgba(0,0,0,.38);
    opacity: 0;
    pointer-events: none;
    transition: .18s ease;
    transform-origin: right center;
  }

  #demoFloatingWidget.open .dfw-tools {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(-50%) scale(1);
  }

  .dfw-tool {
    position: relative;
    width: 39px;
    height: 39px;
    border: 0;
    border-radius: 10px;
    background: #17202a;
    color: #c7d0db;
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .dfw-tool:hover,
  .dfw-tool:active {
    background: #202b37;
    color: #fff;
  }

  .dfw-tool svg {
    width: 18px;
    height: 18px;
  }

  .dfw-dot {
    display: none;
    position: absolute;
    right: 5px;
    top: 5px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ff4d5e;
    box-shadow: 0 0 0 2px #17202a;
  }

  .dfw-tool.has-new .dfw-dot {
    display: block;
  }

  .dfw-tip {
    position: absolute;
    right: 48px;
    white-space: nowrap;
    background: #0a0f15;
    border: 1px solid #26313d;
    color: #c5cfda;
    padding: 6px 8px;
    border-radius: 7px;
    font-size: 11px;
    opacity: 0;
    pointer-events: none;
  }

  .dfw-tool:hover .dfw-tip {
    opacity: 1;
  }

  /* =========================
     MODAL
  ========================= */

  .dfw-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99995;
    background: rgba(0,0,0,.55);
    display: none;
    align-items: center;
    justify-content: center;
    padding: 18px;
  }

  .dfw-modal-backdrop.show {
    display: flex;
  }

  .dfw-modal {
    width: min(410px,100%);
    max-height: 78vh;
    overflow: auto;
    background: #111821;
    border: 1px solid #2b3642;
    border-radius: 16px;
    box-shadow: 0 22px 60px rgba(0,0,0,.5);
    color: #eef3f8;
  }

  .dfw-modal-head {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 15px 16px;
    border-bottom: 1px solid #222d38;
    background: #111821;
  }

  .dfw-modal-title {
    font-size: 15px;
    font-weight: 800;
  }

  .dfw-close {
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 8px;
    background: #1b2530;
    color: #aeb9c5;
    font-size: 20px;
    cursor: pointer;
  }

  .dfw-modal-body {
    padding: 16px;
  }

  .dfw-empty,
  .dfw-loading {
    padding: 22px 10px;
    text-align: center;
    color: #7f8b99;
    font-size: 12px;
    line-height: 1.6;
  }

  /* =========================
     NOTIFICATIONS
  ========================= */

  .dfw-notification-list {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .dfw-notification {
    border: 1px solid #27323e;
    border-radius: 12px;
    background: #0c1219;
    padding: 12px;
  }

  .dfw-notification.new {
    border-color: #35567a;
    background: #0e1823;
  }

  .dfw-notification-top {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .dfw-notification-icon {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    background: #17212c;
    font-size: 16px;
  }

  .dfw-notification-main {
    min-width: 0;
    flex: 1;
  }

  .dfw-notification-title {
    font-size: 12px;
    font-weight: 800;
    line-height: 1.35;
  }

  .dfw-notification-time {
    color: #6f7d8c;
    font-size: 9px;
    margin-top: 3px;
  }

  .dfw-notification-message {
    color: #a7b3c0;
    font-size: 11px;
    line-height: 1.5;
    margin-top: 7px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .dfw-notification-new {
    width: 7px;
    height: 7px;
    flex: 0 0 7px;
    border-radius: 50%;
    background: #ff4d5e;
    margin-top: 5px;
  }

  /* =========================
     SUPPORT
  ========================= */

  .dfw-support-card {
    border: 1px solid #27323e;
    border-radius: 13px;
    background: #0c1219;
    padding: 14px;
  }

  .dfw-support-label {
    font-size: 11px;
    color: #788696;
    margin-bottom: 6px;
  }

  .dfw-support-value {
    font-size: 16px;
    font-weight: 800;
  }

  .dfw-support-status {
    font-size: 11px;
    color: #20c997;
    margin-top: 5px;
  }

  .dfw-support-btn {
    display: block;
    text-align: center;
    text-decoration: none;
    margin-top: 14px;
    padding: 11px;
    border-radius: 10px;
    background: #2f80ed;
    color: #fff;
    font-size: 13px;
    font-weight: 800;
  }

  @media (max-width:600px) {
    .dfw-tip {
      display: none;
    }

    .dfw-tools {
      right: 37px;
    }

    .dfw-tool {
      width: 37px;
      height: 37px;
    }
  }
  `;

  const style =
    document.createElement("style");

  style.textContent = css;

  document.head.appendChild(style);

  /* =========================
     ICONS
  ========================= */

  const icons = {

    bell: `
    <svg viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
      <path d="M10 21h4"/>
    </svg>
    `,

    calendar: `
    <svg viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8">
      <rect x="3" y="5"
      width="18"
      height="16"
      rx="2"/>
      <path d="M16 3v4M8 3v4M3 10h18"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
    </svg>
    `,

    news: `
    <svg viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8">
      <path d="M4 4h13v16H5a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Z"/>
      <path d="M17 8h5v9a3 3 0 0 1-3 3h-2"/>
      <path d="M7 8h6M7 12h6M7 16h4"/>
    </svg>
    `,

    gift: `
    <svg viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8">
      <rect x="3" y="8"
      width="18"
      height="13"
      rx="2"/>
      <path d="M12 8v13M3 12h18"/>
      <path d="M7.5 8C5 8 4 6.8 4 5.5S5 3 6.5 3C9 3 12 8 12 8"/>
      <path d="M16.5 8C19 8 20 6.8 20 5.5S19 3 17.5 3C15 3 12 8 12 8"/>
    </svg>
    `,

    support: `
    <svg viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2"/>
      <path d="M4 14a2 2 0 0 0 0 4h2v-6H4"/>
      <path d="M20 14a2 2 0 0 1 0 4h-2v-6h2"/>
      <path d="M18 18c0 2-2 3-5 3"/>
    </svg>
    `,

    arrow: `
    <svg viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2">
      <path d="m14 6-6 6 6 6"/>
    </svg>
    `
  };

  /* =========================
     WIDGET
  ========================= */

  const root =
    document.createElement("div");

  root.id =
    "demoFloatingWidget";

  root.innerHTML = `

    <button
      class="dfw-handle"
      type="button"
      aria-label="Open quick tools"
    >
      ${icons.arrow}
    </button>

    <div class="dfw-tools">

      <button
        class="dfw-tool"
        data-action="notifications"
        type="button"
      >
        ${icons.bell}

        <span class="dfw-dot"></span>

        <span class="dfw-tip">
          Notifications
        </span>
      </button>

      <button
        class="dfw-tool"
        data-action="pnl"
        type="button"
      >
        ${icons.calendar}

        <span class="dfw-tip">
          P&L Calendar
        </span>
      </button>

      <button
        class="dfw-tool"
        data-action="news"
        type="button"
      >
        ${icons.news}

        <span class="dfw-dot"></span>

        <span class="dfw-tip">
          News
        </span>
      </button>

      <button
        class="dfw-tool"
        data-action="events"
        type="button"
      >
        ${icons.gift}

        <span class="dfw-dot"></span>

        <span class="dfw-tip">
          Events
        </span>
      </button>

      <button
        class="dfw-tool"
        data-action="support"
        type="button"
      >
        ${icons.support}

        <span class="dfw-tip">
          Support
        </span>
      </button>

    </div>
  `;

  document.body.appendChild(root);

  /* =========================
     MODAL HTML
  ========================= */

  const backdrop =
    document.createElement("div");

  backdrop.className =
    "dfw-modal-backdrop";

  backdrop.innerHTML = `

    <div
      class="dfw-modal"
      role="dialog"
      aria-modal="true"
    >

      <div class="dfw-modal-head">

        <div
          class="dfw-modal-title"
          id="dfwModalTitle"
        ></div>

        <button
          class="dfw-close"
          type="button"
        >
          ×
        </button>

      </div>

      <div
        class="dfw-modal-body"
        id="dfwModalBody"
      ></div>

    </div>
  `;

  document.body.appendChild(backdrop);

  const handle =
    root.querySelector(".dfw-handle");

  const tools =
    root.querySelector(".dfw-tools");

  const modalTitle =
    backdrop.querySelector(
      "#dfwModalTitle"
    );

  const modalBody =
    backdrop.querySelector(
      "#dfwModalBody"
    );

  const notificationButton =
    root.querySelector(
      '[data-action="notifications"]'
    );

  /* =========================
     UID
  ========================= */

  function getUid() {

    let value =
      localStorage.getItem(
        "demoUid"
      );

    if (!value) {

      value =
        "DEMO-" +
        String(
          Math.floor(
            100000 +
            Math.random() *
            900000
          )
        );

      localStorage.setItem(
        "demoUid",
        value
      );
    }

    return value;
  }

  /* =========================
     HELPERS
  ========================= */

  function esc(value) {

    return String(
      value ?? ""
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clamp(
    value,
    min,
    max
  ) {

    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );
  }

  /* =========================
     POSITION
  ========================= */

  function savePos() {

    const rect =
      root.getBoundingClientRect();

    localStorage.setItem(
      POS_KEY,
      JSON.stringify({
        side:
          rect.left <
          innerWidth / 2
            ? "left"
            : "right",

        y: rect.top
      })
    );
  }

  function dock() {

    const rect =
      root.getBoundingClientRect();

    const side =
      rect.left +
      rect.width / 2 <
      innerWidth / 2
        ? "left"
        : "right";

    const y =
      clamp(
        rect.top,
        10,
        innerHeight -
        rect.height -
        80
      );

    root.style.top =
      y + "px";

    root.style.left =
      side === "left"
        ? "0px"
        : (innerWidth - 34) +
          "px";

    root.style.right =
      "auto";

    savePos();
  }

  function restorePosition() {

    try {

      const position =
        JSON.parse(
          localStorage.getItem(
            POS_KEY
          ) || "null"
        );

      if (!position) return;

      root.style.top =
        clamp(
          Number(position.y) ||
          100,
          10,
          innerHeight - 130
        ) + "px";

      root.style.left =
        position.side ===
        "left"
          ? "0px"
          : (innerWidth - 34) +
            "px";

    } catch (_) {}
  }

  restorePosition();

  /* =========================
     DRAG
  ========================= */

  let dragging = false;
  let moved = false;

  let startX = 0;
  let startY = 0;

  let startLeft = 0;
  let startTop = 0;

  handle.addEventListener(
    "pointerdown",
    function (event) {

      dragging = true;
      moved = false;

      startX =
        event.clientX;

      startY =
        event.clientY;

      const rect =
        root.getBoundingClientRect();

      startLeft =
        rect.left;

      startTop =
        rect.top;

      handle.setPointerCapture(
        event.pointerId
      );
    }
  );

  handle.addEventListener(
    "pointermove",
    function (event) {

      if (!dragging) return;

      const dx =
        event.clientX -
        startX;

      const dy =
        event.clientY -
        startY;

      if (
        Math.abs(dx) +
        Math.abs(dy) >
        5
      ) {
        moved = true;
      }

      if (!moved) return;

      root.classList.remove(
        "open"
      );

      root.style.left =
        clamp(
          startLeft + dx,
          0,
          innerWidth - 34
        ) + "px";

      root.style.top =
        clamp(
          startTop + dy,
          8,
          innerHeight - 54
        ) + "px";
    }
  );

  handle.addEventListener(
    "pointerup",
    function () {

      if (!dragging) return;

      dragging = false;

      if (moved) {

        dock();

        return;
      }

      root.classList.toggle(
        "open"
      );
    }
  );

  window.addEventListener(
    "resize",
    dock
  );

  /* =========================
     MODAL
  ========================= */

  function openModal(
    title,
    html
  ) {

    root.classList.remove(
      "open"
    );

    modalTitle.textContent =
      title;

    modalBody.innerHTML =
      html;

    backdrop.classList.add(
      "show"
    );
  }

  function closeModal() {

    backdrop.classList.remove(
      "show"
    );
  }

  backdrop
    .querySelector(
      ".dfw-close"
    )
    .addEventListener(
      "click",
      closeModal
    );

  backdrop.addEventListener(
    "click",
    function (event) {

      if (
        event.target ===
        backdrop
      ) {
        closeModal();
      }
    }
  );

  /* =========================
     NOTIFICATION HELPERS
  ========================= */

  function notificationIcon(
    type
  ) {

    switch (
      String(
        type || ""
      ).toLowerCase()
    ) {

      case "trade":
        return "↕";

      case "deposit":
        return "+";

      case "withdrawal":
        return "−";

      case "balance":
        return "$";

      case "account":
        return "✓";

      default:
        return "•";
    }
  }

  function formatTime(
    value
  ) {

    if (!value) return "";

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return date.toLocaleString();
  }

  function lastSeenNotificationId() {

    const number =
      Number(
        localStorage.getItem(
          NOTIFY_SEEN_KEY
        )
      );

    return Number.isFinite(
      number
    )
      ? number
      : 0;
  }

  function setLastSeenNotificationId(
    id
  ) {

    const number =
      Number(id);

    if (
      !Number.isFinite(
        number
      ) ||
      number <= 0
    ) {
      return;
    }

    localStorage.setItem(
      NOTIFY_SEEN_KEY,
      String(number)
    );
  }

  /* =========================
     FETCH NOTIFICATIONS
  ========================= */

  async function fetchNotifications(
    limit = 30
  ) {

    const url =
      SUPABASE_URL +
      "/rest/v1/notifications" +
      "?select=" +
      "id,uid,type,title,message,is_read,related_id,created_at" +
      "&uid=eq." +
      encodeURIComponent(
        getUid()
      ) +
      "&order=id.desc" +
      "&limit=" +
      encodeURIComponent(
        limit
      );

    const response =
      await fetch(
        url,
        {
          headers: {
            apikey:
              SUPABASE_KEY,

            Authorization:
              "Bearer " +
              SUPABASE_KEY
          },

          cache:
            "no-store"
        }
      );

    if (!response.ok) {

      throw new Error(
        "Could not load notifications."
      );
    }

    return await response.json();
  }

  /* =========================
     RED DOT
  ========================= */

  async function refreshNotificationDot() {

    try {

      const rows =
        await fetchNotifications(
          1
        );

      if (
        !Array.isArray(rows) ||
        !rows.length
      ) {

        notificationButton
          .classList
          .remove(
            "has-new"
          );

        return;
      }

      const latestId =
        Number(
          rows[0].id
        ) || 0;

      if (
        latestId >
        lastSeenNotificationId()
      ) {

        notificationButton
          .classList
          .add(
            "has-new"
          );

      } else {

        notificationButton
          .classList
          .remove(
            "has-new"
          );
      }

    } catch (error) {

      console.warn(
        "Notification refresh failed:",
        error
      );
    }
  }

  /* =========================
     OPEN NOTIFICATIONS
  ========================= */

  async function openNotifications() {

    openModal(
      "Notifications",
      `
      <div class="dfw-loading">
        Loading notifications...
      </div>
      `
    );

    try {

      const rows =
        await fetchNotifications(
          30
        );

      if (
        !Array.isArray(rows) ||
        !rows.length
      ) {

        modalBody.innerHTML =
          `
          <div class="dfw-empty">
            No notifications yet.
          </div>
          `;

        notificationButton
          .classList
          .remove(
            "has-new"
          );

        return;
      }

      const previousSeen =
        lastSeenNotificationId();

      modalBody.innerHTML =
        `
        <div class="dfw-notification-list">
        ` +

        rows.map(
          function (item) {

            const id =
              Number(
                item.id
              ) || 0;

            const isNew =
              id >
              previousSeen;

            return `

            <div class="
              dfw-notification
              ${isNew ? "new" : ""}
            ">

              <div class="
                dfw-notification-top
              ">

                <div class="
                  dfw-notification-icon
                ">
                  ${notificationIcon(
                    item.type
                  )}
                </div>

                <div class="
                  dfw-notification-main
                ">

                  <div class="
                    dfw-notification-title
                  ">
                    ${esc(
                      item.title ||
                      "Notification"
                    )}
                  </div>

                  <div class="
                    dfw-notification-time
                  ">
                    ${esc(
                      formatTime(
                        item.created_at
                      )
                    )}
                  </div>

                  <div class="
                    dfw-notification-message
                  ">
                    ${esc(
                      item.message ||
                      ""
                    )}
                  </div>

                </div>

                ${
                  isNew
                    ? `
                      <span
                        class="
                          dfw-notification-new
                        "
                      ></span>
                    `
                    : ""
                }

              </div>

            </div>
            `;
          }
        ).join("") +

        `
        </div>
        `;

      const newestId =
        Math.max(
          ...rows.map(
            function (item) {
              return (
                Number(
                  item.id
                ) || 0
              );
            }
          )
        );

      setLastSeenNotificationId(
        newestId
      );

      notificationButton
        .classList
        .remove(
          "has-new"
        );

    } catch (error) {

      console.error(
        error
      );

      modalBody.innerHTML =
        `
        <div class="dfw-empty">
          Unable to load notifications right now.
        </div>
        `;
    }
  }

  /* =========================
     BUTTON ACTIONS
  ========================= */

  tools.addEventListener(
    "click",
    function (event) {

      const button =
        event.target.closest(
          ".dfw-tool"
        );

      if (!button) return;

      const action =
        button.dataset.action;

      /* NOTIFICATIONS */

      if (
        action ===
        "notifications"
      ) {

        openNotifications();

        return;
      }

      /* P&L */

      if (
        action ===
        "pnl"
      ) {

        if (
          location.pathname
            .endsWith(
              "/pnl.html"
            )
        ) {

          root.classList.remove(
            "open"
          );

          return;
        }

        location.href =
          "pnl.html";

        return;
      }

      /* NEWS */

      if (
        action ===
        "news"
      ) {

        openModal(
          "Crypto News",
          `
          <div class="dfw-empty">
            Automatic crypto market news
            will appear here after the
            News service is connected.
          </div>
          `
        );

        return;
      }

      /* EVENTS */

      if (
        action ===
        "events"
      ) {

        openModal(
          "Events",
          `
          <div class="dfw-empty">
            Platform events and promotions
            will appear here after the
            Events section is connected.
          </div>
          `
        );

        return;
      }

      /* SUPPORT */

      if (
        action ===
        "support"
      ) {

        openModal(
          "Customer Service",
          `

          <div class="
            dfw-support-card
          ">

            <div class="
              dfw-support-label
            ">
              Telegram Support
            </div>

            <div class="
              dfw-support-value
            ">
              ${SUPPORT_HANDLE}
            </div>

            <div class="
              dfw-support-status
            ">
              ● Online Support
            </div>

            <a
              class="
                dfw-support-btn
              "
              href="
                ${SUPPORT_URL}
              "
              target="_blank"
              rel="noopener"
            >
              Contact via Telegram
            </a>

          </div>
          `
        );

        return;
      }
    }
  );

  /* =========================
     CLICK OUTSIDE
  ========================= */

  document.addEventListener(
    "pointerdown",
    function (event) {

      if (
        !root.contains(
          event.target
        ) &&
        !backdrop.contains(
          event.target
        )
      ) {

        root.classList.remove(
          "open"
        );
      }
    }
  );

  /* =========================
     CROSS TAB
  ========================= */

  window.addEventListener(
    "storage",
    function (event) {

      if (
        event.key ===
        NOTIFY_SEEN_KEY ||
        event.key ===
        "demoUid"
      ) {

        refreshNotificationDot();
      }
    }
  );

  /* =========================
     AUTO REFRESH
  ========================= */

  window.addEventListener(
    "focus",
    refreshNotificationDot
  );

  refreshNotificationDot();

  setInterval(
    refreshNotificationDot,
    15000
  );

  /* =========================
     PUBLIC API
  ========================= */

  window.DemoFloatingWidget = {

    open: function () {

      root.classList.add(
        "open"
      );
    },

    close: function () {

      root.classList.remove(
        "open"
      );
    },

    refreshNotifications:
      refreshNotificationDot,

    showNotifications:
      openNotifications,

    showSupport:
      function () {

        openModal(
          "Customer Service",
          `

          <div class="
            dfw-support-card
          ">

            <div class="
              dfw-support-label
            ">
              Telegram Support
            </div>

            <div class="
              dfw-support-value
            ">
              ${SUPPORT_HANDLE}
            </div>

            <div class="
              dfw-support-status
            ">
              ● Online Support
            </div>

            <a
              class="
                dfw-support-btn
              "
              href="
                ${SUPPORT_URL}
              "
              target="_blank"
              rel="noopener"
            >
              Contact via Telegram
            </a>

          </div>
          `
        );
      }
  };

})();
