(() => {
  'use strict';

  if (window.__demoFloatingWidgetLoaded) return;
  window.__demoFloatingWidgetLoaded = true;

  const SUPABASE_URL = 'https://cyvquivolvkxzcseyhvk.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_dy2_qtfTrOjeD-kPKohHiQ_zKHxZEHU';

  const POSITION_KEY = 'demoFloatingWidgetPosition';
  const NOTIFICATION_READ_KEY = 'demoNotificationReadIds';

  const SUPPORT_URL = 'https://t.me/Kath02210';

  const style = document.createElement('style');

  style.textContent = `
    #dfw-root,
    #dfw-root * {
      box-sizing: border-box;
    }

    #dfw-root {
      position: fixed;
      z-index: 99990;
      top: 42%;
      right: 0;
      font-family:
        Inter,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;
      user-select: none;
      touch-action: none;
    }

    #dfw-root[data-side="left"] {
      left: 0;
      right: auto;
    }

    #dfw-root[data-side="right"] {
      right: 0;
      left: auto;
    }

    #dfw-handle {
      position: relative;
      width: 34px;
      height: 46px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(22,26,34,.96);
      box-shadow: 0 6px 24px rgba(0,0,0,.34);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition:
        background .18s ease,
        transform .18s ease;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    #dfw-root[data-side="right"] #dfw-handle {
      border-radius: 12px 0 0 12px;
      border-right: 0;
    }

    #dfw-root[data-side="left"] #dfw-handle {
      border-radius: 0 12px 12px 0;
      border-left: 0;
    }

    #dfw-handle:hover {
      background: rgba(31,36,46,.98);
    }

    #dfw-handle svg {
      width: 17px;
      height: 17px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      pointer-events: none;
      transition: transform .2s ease;
    }

    #dfw-root[data-side="right"] #dfw-handle svg {
      transform: rotate(180deg);
    }

    #dfw-root[data-side="left"] #dfw-handle svg {
      transform: rotate(0deg);
    }

    #dfw-root.open[data-side="right"] #dfw-handle svg {
      transform: rotate(0deg);
    }

    #dfw-root.open[data-side="left"] #dfw-handle svg {
      transform: rotate(180deg);
    }

    #dfw-tools {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 178px;
      padding: 7px;
      background: rgba(18,22,29,.98);
      border: 1px solid rgba(255,255,255,.11);
      box-shadow: 0 10px 32px rgba(0,0,0,.42);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition:
        opacity .18s ease,
        transform .18s ease,
        visibility .18s ease;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    #dfw-root[data-side="right"] #dfw-tools {
      right: 39px;
      border-radius: 12px;
      transform: translate(8px,-50%);
    }

    #dfw-root[data-side="left"] #dfw-tools {
      left: 39px;
      border-radius: 12px;
      transform: translate(-8px,-50%);
    }

    #dfw-root.open #dfw-tools {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translate(0,-50%);
    }

    .dfw-tool {
      position: relative;
      width: 100%;
      min-height: 43px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: #e9edf4;
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 8px 10px;
      cursor: pointer;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      transition: background .15s ease;
    }

    .dfw-tool:hover {
      background: rgba(255,255,255,.07);
    }

    .dfw-tool-icon {
      position: relative;
      width: 24px;
      height: 24px;
      min-width: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #dce3ed;
    }

    .dfw-tool-icon svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .dfw-dot {
      display: none;
      position: absolute;
      width: 8px;
      height: 8px;
      right: 0;
      top: 0;
      border-radius: 50%;
      background: #f04444;
      border: 2px solid #171b22;
      box-shadow: 0 0 0 1px rgba(240,68,68,.15);
    }

    .dfw-dot.has-new {
      display: block;
    }

    #dfw-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99998;
      background: rgba(0,0,0,.56);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
      font-family:
        Inter,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;
    }

    #dfw-modal-backdrop.show {
      display: flex;
    }

    #dfw-modal {
      width: min(430px,100%);
      max-height: min(640px,82vh);
      overflow: hidden;
      background: #151922;
      color: #f4f6fa;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 16px;
      box-shadow: 0 22px 60px rgba(0,0,0,.52);
      animation: dfwPop .16s ease-out;
    }

    @keyframes dfwPop {
      from {
        opacity: 0;
        transform: scale(.97);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .dfw-modal-head {
      min-height: 58px;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .dfw-modal-title {
      font-size: 16px;
      font-weight: 750;
      color: #fff;
    }

    #dfw-modal-close {
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 8px;
      background: rgba(255,255,255,.06);
      color: #dce2ea;
      cursor: pointer;
      font-size: 21px;
      line-height: 1;
    }

    #dfw-modal-close:hover {
      background: rgba(255,255,255,.1);
    }

    #dfw-modal-body {
      padding: 16px;
      overflow-y: auto;
      max-height: calc(82vh - 59px);
      color: #cbd2dd;
      font-size: 14px;
      line-height: 1.55;
    }

    .dfw-placeholder {
      padding: 24px 10px;
      text-align: center;
      color: #8f99a8;
    }

    .dfw-support-box {
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.035);
      border-radius: 12px;
      padding: 16px;
    }

    .dfw-support-name {
      color: #fff;
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .dfw-support-user {
      color: #aeb7c4;
      margin-bottom: 12px;
    }

    .dfw-online {
      display: flex;
      align-items: center;
      gap: 7px;
      color: #bfc7d2;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .dfw-online-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #26c281;
    }

    .dfw-primary-btn {
      width: 100%;
      border: 0;
      border-radius: 9px;
      min-height: 43px;
      padding: 10px 14px;
      background: #2563eb;
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }

    .dfw-primary-btn:hover {
      filter: brightness(1.08);
    }

    .dfw-notification-list {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    .dfw-notification {
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.035);
      border-radius: 11px;
      padding: 12px;
    }

    .dfw-notification.unread {
      border-color: rgba(64,120,255,.42);
      background: rgba(37,99,235,.08);
    }

    .dfw-notification-title {
      color: #f4f6fa;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .dfw-notification-message {
      color: #b7c0cc;
      font-size: 13px;
      line-height: 1.45;
      word-break: break-word;
    }

    .dfw-notification-time {
      color: #747f8e;
      font-size: 11px;
      margin-top: 7px;
    }

    @media (max-width: 600px) {
      #dfw-tools {
        width: 166px;
      }

      .dfw-tool {
        min-height: 42px;
      }

      #dfw-root {
        top: 40%;
      }
    }
  `;

  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'dfw-root';
  root.dataset.side = 'right';

  root.innerHTML = `
    <div id="dfw-tools">

      <button class="dfw-tool" type="button" data-action="notifications">
        <span class="dfw-tool-icon">
          <svg viewBox="0 0 24 24">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
            <path d="M10 21h4"></path>
          </svg>
          <span id="dfw-notification-dot" class="dfw-dot"></span>
        </span>
        <span>Notifications</span>
      </button>

      <button class="dfw-tool" type="button" data-action="pnl">
        <span class="dfw-tool-icon">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="16" rx="2"></rect>
            <path d="M16 3v4M8 3v4M3 10h18"></path>
            <path d="M8 14h2M14 14h2M8 18h2M14 18h2"></path>
          </svg>
        </span>
        <span>P&amp;L Calendar</span>
      </button>

      <button class="dfw-tool" type="button" data-action="news">
        <span class="dfw-tool-icon">
          <svg viewBox="0 0 24 24">
            <path d="M4 5h13v14H4z"></path>
            <path d="M17 8h3v9a2 2 0 0 1-2 2h-1"></path>
            <path d="M7 9h7M7 13h7M7 17h5"></path>
          </svg>
          <span id="dfw-news-dot" class="dfw-dot"></span>
        </span>
        <span>News</span>
      </button>

      <button class="dfw-tool" type="button" data-action="events">
        <span class="dfw-tool-icon">
          <svg viewBox="0 0 24 24">
            <path d="M20 12v8H4v-8"></path>
            <path d="M2 7h20v5H2z"></path>
            <path d="M12 7v13"></path>
            <path d="M12 7H7.5A2.5 2.5 0 1 1 10 4.5L12 7z"></path>
            <path d="M12 7h4.5A2.5 2.5 0 1 0 14 4.5L12 7z"></path>
          </svg>
          <span id="dfw-events-dot" class="dfw-dot"></span>
        </span>
        <span>Events</span>
      </button>

      <button class="dfw-tool" type="button" data-action="support">
        <span class="dfw-tool-icon">
          <svg viewBox="0 0 24 24">
            <path d="M4 13v-2a8 8 0 0 1 16 0v2"></path>
            <path d="M4 13a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v-6z"></path>
            <path d="M20 13a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2v-6z"></path>
            <path d="M18 19c0 2-2 2-4 2"></path>
          </svg>
        </span>
        <span>Support</span>
      </button>

    </div>

    <div id="dfw-handle" role="button" aria-label="Open quick menu">
      <svg viewBox="0 0 24 24">
        <path d="m9 18 6-6-6-6"></path>
      </svg>
    </div>
  `;

  document.body.appendChild(root);

  const backdrop = document.createElement('div');
  backdrop.id = 'dfw-modal-backdrop';

  backdrop.innerHTML = `
    <div id="dfw-modal" role="dialog" aria-modal="true">
      <div class="dfw-modal-head">
        <div id="dfw-modal-title" class="dfw-modal-title"></div>
        <button id="dfw-modal-close" type="button">×</button>
      </div>

      <div id="dfw-modal-body"></div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const handle = document.getElementById('dfw-handle');
  const tools = document.getElementById('dfw-tools');

  const modalTitle = document.getElementById('dfw-modal-title');
  const modalBody = document.getElementById('dfw-modal-body');
  const modalClose = document.getElementById('dfw-modal-close');

  const notificationDot =
    document.getElementById('dfw-notification-dot');

  let dragging = false;
  let moved = false;

  let pointerStartX = 0;
  let pointerStartY = 0;
  let startTop = 0;

  let notifications = [];

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getUid() {
    return (
      localStorage.getItem('demoUid') ||
      localStorage.getItem('demoUID') ||
      ''
    ).trim();
  }

  function getReadIds() {
    try {
      const parsed =
        JSON.parse(
          localStorage.getItem(NOTIFICATION_READ_KEY) || '[]'
        );

      return Array.isArray(parsed)
        ? parsed.map(String)
        : [];
    } catch (_) {
      return [];
    }
  }

  function saveReadIds(ids) {
    const clean = [...new Set(ids.map(String))].slice(-500);

    localStorage.setItem(
      NOTIFICATION_READ_KEY,
      JSON.stringify(clean)
    );
  }

  function formatDate(value) {
    if (!value) return '';

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return '';
    }

    return d.toLocaleString();
  }

  function openMenu() {
    root.classList.add('open');
  }

  function closeMenu() {
    root.classList.remove('open');
  }

  function toggleMenu() {
    root.classList.toggle('open');
  }

  function openModal(title, html) {
    closeMenu();

    modalTitle.textContent = title;
    modalBody.innerHTML = html;

    backdrop.classList.add('show');
  }

  function closeModal() {
    backdrop.classList.remove('show');
  }

  function savePosition() {
    try {
      localStorage.setItem(
        POSITION_KEY,
        JSON.stringify({
          side: root.dataset.side || 'right',
          y: parseFloat(root.style.top) || 42
        })
      );
    } catch (_) {}
  }

  function restorePosition() {
    try {
      const data =
        JSON.parse(
          localStorage.getItem(POSITION_KEY) || 'null'
        );

      if (!data) return;

      if (data.side === 'left' || data.side === 'right') {
        root.dataset.side = data.side;
      }

      if (
        Number.isFinite(Number(data.y)) &&
        Number(data.y) >= 5 &&
        Number(data.y) <= 88
      ) {
        root.style.top = Number(data.y) + '%';
      }
    } catch (_) {}
  }

  restorePosition();

  function dockToNearestEdge(clientX) {
    if (clientX < window.innerWidth / 2) {
      root.dataset.side = 'left';
    } else {
      root.dataset.side = 'right';
    }

    savePosition();
  }

  handle.addEventListener('pointerdown', e => {
    dragging = true;
    moved = false;

    pointerStartX = e.clientX;
    pointerStartY = e.clientY;

    startTop = root.getBoundingClientRect().top;

    try {
      handle.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  handle.addEventListener('pointermove', e => {
    if (!dragging) return;

    const dx = e.clientX - pointerStartX;
    const dy = e.clientY - pointerStartY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      moved = true;
    }

    if (!moved) return;

    closeMenu();

    let newTop = startTop + dy;

    const maxTop =
      window.innerHeight -
      root.offsetHeight -
      80;

    newTop = Math.max(
      30,
      Math.min(newTop, Math.max(30, maxTop))
    );

    root.style.top =
      (newTop / window.innerHeight) * 100 + '%';
  });

  handle.addEventListener('pointerup', e => {
    if (!dragging) return;

    dragging = false;

    try {
      handle.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (moved) {
      dockToNearestEdge(e.clientX);
      savePosition();
      return;
    }

    toggleMenu();
  });

  handle.addEventListener('pointercancel', () => {
    dragging = false;
  });

  document.addEventListener('pointerdown', e => {
    if (!root.contains(e.target)) {
      closeMenu();
    }
  });

  modalClose.addEventListener('click', closeModal);

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) {
      closeModal();
    }
  });

  function showSupport() {
    openModal(
      'Customer Service',
      `
        <div class="dfw-support-box">

          <div class="dfw-support-name">
            Online Support
          </div>

          <div class="dfw-support-user">
            Telegram: @Kath02210
          </div>

          <div class="dfw-online">
            <span class="dfw-online-dot"></span>
            <span>Online Support</span>
          </div>

          <button
            id="dfw-contact-support"
            class="dfw-primary-btn"
            type="button"
          >
            Contact via Telegram
          </button>

        </div>
      `
    );

    const button =
      document.getElementById('dfw-contact-support');

    if (button) {
      button.addEventListener('click', () => {
        window.open(
          SUPPORT_URL,
          '_blank',
          'noopener,noreferrer'
        );
      });
    }
  }

  function showPlaceholder(title, message) {
    openModal(
      title,
      `
        <div class="dfw-placeholder">
          ${esc(message)}
        </div>
      `
    );
  }

  async function fetchNotifications() {
    const uid = getUid();

    if (!uid) {
      notifications = [];
      notificationDot.classList.remove('has-new');
      return [];
    }

    try {
      /*
        这里已经修正。

        旧版错误字段：
        is_read
        related_id

        现在使用你 notifications 表实际字段：
        source_type
        source_id
      */

      const url =
        SUPABASE_URL +
        '/rest/v1/notifications' +
        '?select=id,uid,type,title,message,source_type,source_id,created_at' +
        '&uid=eq.' +
        encodeURIComponent(uid) +
        '&order=created_at.desc' +
        '&limit=30';

      const response = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(
          'Notifications HTTP ' + response.status
        );
      }

      const rows = await response.json();

      notifications =
        Array.isArray(rows)
          ? rows
          : [];

      updateNotificationDot();

      return notifications;

    } catch (error) {
      console.warn(
        '[Floating Widget] Notification load failed:',
        error
      );

      return [];
    }
  }

  function updateNotificationDot() {
    const readIds = new Set(getReadIds());

    const hasUnread =
      notifications.some(
        item => !readIds.has(String(item.id))
      );

    notificationDot.classList.toggle(
      'has-new',
      hasUnread
    );
  }

  function markNotificationsRead() {
    if (!notifications.length) return;

    const ids = getReadIds();

    for (const item of notifications) {
      ids.push(String(item.id));
    }

    saveReadIds(ids);
    updateNotificationDot();
  }

  async function showNotifications() {
    openModal(
      'Notifications',
      `
        <div class="dfw-placeholder">
          Loading notifications...
        </div>
      `
    );

    const rows = await fetchNotifications();

    if (!backdrop.classList.contains('show')) {
      return;
    }

    if (!rows.length) {
      modalBody.innerHTML = `
        <div class="dfw-placeholder">
          No notifications yet.
        </div>
      `;

      markNotificationsRead();
      return;
    }

    const readIds =
      new Set(getReadIds());

    modalBody.innerHTML = `
      <div class="dfw-notification-list">
        ${rows.map(item => {

          const unread =
            !readIds.has(String(item.id));

          return `
            <div class="
              dfw-notification
              ${unread ? 'unread' : ''}
            ">

              <div class="dfw-notification-title">
                ${esc(item.title || 'Notification')}
              </div>

              <div class="dfw-notification-message">
                ${esc(item.message || '')}
              </div>

              <div class="dfw-notification-time">
                ${esc(formatDate(item.created_at))}
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    markNotificationsRead();
  }

  tools.addEventListener('click', e => {
    const button =
      e.target.closest('.dfw-tool');

    if (!button) return;

    const action =
      button.dataset.action;

    if (action === 'notifications') {
      showNotifications();
      return;
    }

    if (action === 'pnl') {
      window.location.href = 'pnl.html';
      return;
    }

    if (action === 'news') {
      showPlaceholder(
        'Crypto News',
        'Crypto News will appear here after the news backend is connected.'
      );
      return;
    }

    if (action === 'events') {
      showPlaceholder(
        'Events',
        'Events and promotions will appear here.'
      );
      return;
    }

    if (action === 'support') {
      showSupport();
    }
  });

  /*
    页面打开时立即读取一次通知。
    之后每 10 秒刷新一次，
    所以 Admin Approve / Reject 后不需要客户刷新页面。
  */

  setTimeout(
    fetchNotifications,
    700
  );

  setInterval(
    fetchNotifications,
    10000
  );

  window.addEventListener(
    'focus',
    fetchNotifications
  );

  window.addEventListener(
    'storage',
    e => {
      if (
        e.key === NOTIFICATION_READ_KEY ||
        e.key === 'demoUid'
      ) {
        fetchNotifications();
      }
    }
  );

})();
