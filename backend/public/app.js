const apiBase = '/api';
const authView = document.getElementById('authView');
const appView = document.getElementById('appView');
const sessionInfo = document.getElementById('sessionInfo');
const toastHost = document.getElementById('toastHost');
let usersCache = [];
let selectedTaskId = null;
let currentPage = 1;
const PAGE_SIZE = 10;
let totalPages = 1;
let quickPriorityFilter = '';
let presetAssignedTo = '';
let autoRefreshEnabled = false;
let autoRefreshTimer = null;
const AUTO_REFRESH_MS = 15000;
const AUTO_REFRESH_MAX_MS = 120000;
let lastRefreshAt = null;
let autoRefreshPausedByVisibility = false;
let connectionFailureCount = 0;
let autoRefreshDelayMs = AUTO_REFRESH_MS;
let wasRetrying = false;
const MAX_EVENT_HISTORY = 10;
const EVENT_HISTORY_STORAGE_KEY = 'wh_event_history';
const EVENT_HISTORY_LAST_CLEARED_KEY = 'wh_event_history_last_cleared';
const eventHistory = [];
let lastClearedEventHistory = [];
let lastClearToken = 0;

function updateSortIndicators() {
  const sortBy = document.getElementById('sortBy').value;
  const sortDir = document.getElementById('sortDir').value;
  const mapping = {
    title: { thId: 'sortIndTitle' },
    status: { thId: 'sortIndStatus' },
    priority: { thId: 'sortIndPriority' },
    updated_at: { thId: 'sortIndUpdated' },
  };

  for (const th of document.querySelectorAll('th.sortable')) {
    th.classList.remove('active');
    th.setAttribute('aria-sort', 'none');
  }

  for (const key of Object.keys(mapping)) {
    const id = mapping[key].thId;
    const node = document.getElementById(id);
    if (node) node.textContent = '↕';
  }

  if (mapping[sortBy]) {
    const th = document.querySelector(`th.sortable[data-sort="${sortBy}"]`);
    if (th) {
      th.classList.add('active');
      th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
    }
    const node = document.getElementById(mapping[sortBy].thId);
    if (node) node.textContent = sortDir === 'asc' ? '↑' : '↓';
  }
}

function toggleSortFromHeader(field) {
  const sortByEl = document.getElementById('sortBy');
  const sortDirEl = document.getElementById('sortDir');
  const currentBy = sortByEl.value;
  const currentDir = sortDirEl.value;

  if (currentBy === field) {
    sortDirEl.value = currentDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortByEl.value = field;
    sortDirEl.value = field === 'title' ? 'asc' : 'desc';
  }

  currentPage = 1;
  updateSortIndicators();
  return loadTasks();
}

function getToken() { return localStorage.getItem('wh_token') || ''; }
function setToken(t) { localStorage.setItem('wh_token', t); }
function clearToken() { localStorage.removeItem('wh_token'); }
function getUser() { try { return JSON.parse(localStorage.getItem('wh_user') || 'null'); } catch { return null; } }
function setUser(u) { localStorage.setItem('wh_user', JSON.stringify(u)); }
function clearUser() { localStorage.removeItem('wh_user'); }
function setViewPreset(v) { localStorage.setItem('wh_view_preset', v || ''); }
function getViewPreset() { return localStorage.getItem('wh_view_preset') || ''; }
function setAutoRefresh(v) { localStorage.setItem('wh_auto_refresh', v ? '1' : '0'); }
function getAutoRefresh() { return localStorage.getItem('wh_auto_refresh') === '1'; }

function eventTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function renderEventHistory() {
  const list = document.getElementById('eventHistoryList');
  if (!list) return;
  if (!eventHistory.length) {
    list.innerHTML = '<li>No events yet.</li>';
    updateEventActionsState();
    return;
  }
  list.innerHTML = eventHistory.map((entry) => `<li>${entry}</li>`).join('');
  updateEventActionsState();
}

function updateEventActionsState() {
  const hasEvents = eventHistory.length > 0;
  const canRestore = !hasEvents && lastClearedEventHistory.length > 0;
  const copyBtn = document.getElementById('copyLastEventBtn');
  const exportBtn = document.getElementById('exportEventHistoryBtn');
  const restoreBtn = document.getElementById('restoreEventHistoryBtn');
  const hint = document.getElementById('eventActionsHint');
  if (copyBtn) copyBtn.disabled = !hasEvents;
  if (exportBtn) exportBtn.disabled = !hasEvents;
  if (restoreBtn) restoreBtn.disabled = !canRestore;
  if (hint) {
    if (hasEvents) {
      hint.classList.add('hidden');
    } else {
      hint.classList.remove('hidden');
      hint.textContent = canRestore
        ? 'You can restore the most recently cleared history.'
        : 'Actions disabled until an event is recorded.';
    }
  }
}

function persistEventHistory() {
  try {
    sessionStorage.setItem(EVENT_HISTORY_STORAGE_KEY, JSON.stringify(eventHistory));
  } catch {
    // Ignore storage errors in restricted/private modes.
  }
}

function persistLastClearedEventHistory() {
  try {
    sessionStorage.setItem(EVENT_HISTORY_LAST_CLEARED_KEY, JSON.stringify(lastClearedEventHistory));
  } catch {
    // Ignore storage errors in restricted/private modes.
  }
}

function restoreEventHistory() {
  try {
    const raw = sessionStorage.getItem(EVENT_HISTORY_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    eventHistory.length = 0;
    for (const entry of parsed.slice(0, MAX_EVENT_HISTORY)) {
      if (typeof entry === 'string') eventHistory.push(entry);
    }
  } catch {
    // Ignore malformed storage payloads.
  }
}

function restoreLastClearedEventHistory() {
  try {
    const raw = sessionStorage.getItem(EVENT_HISTORY_LAST_CLEARED_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    lastClearedEventHistory = parsed
      .filter((entry) => typeof entry === 'string')
      .slice(0, MAX_EVENT_HISTORY);
  } catch {
    // Ignore malformed storage payloads.
  }
}

function clearEventHistory() {
  lastClearToken += 1;
  lastClearedEventHistory = [...eventHistory];
  eventHistory.length = 0;
  persistLastClearedEventHistory();
  persistEventHistory();
  renderEventHistory();
  const line = document.getElementById('statusEventLine');
  if (line) {
    line.textContent = `Event history cleared • ${eventTime()}`;
  }

  return lastClearToken;
}

function restoreClearedEventHistory() {
  if (!lastClearedEventHistory.length || eventHistory.length) {
    return;
  }

  eventHistory.length = 0;
  for (const entry of lastClearedEventHistory.slice(0, MAX_EVENT_HISTORY)) {
    eventHistory.push(entry);
  }
  lastClearedEventHistory = [];
  persistLastClearedEventHistory();
  persistEventHistory();
  renderEventHistory();
  const line = document.getElementById('statusEventLine');
  if (line) {
    line.textContent = `Event history restored • ${eventTime()}`;
  }
}

function parseEventEntry(entry) {
  const marker = ' • ';
  const idx = entry.lastIndexOf(marker);
  if (idx === -1) {
    return { message: entry, time: '' };
  }
  return {
    message: entry.slice(0, idx),
    time: entry.slice(idx + marker.length),
  };
}

function toCsvRow(fields) {
  return fields
    .map((f) => `"${String(f ?? '').replace(/"/g, '""')}"`)
    .join(',');
}

function buildEventHistoryExport(format) {
  if (format === 'csv') {
    const header = toCsvRow(['Time', 'Message']);
    const rows = eventHistory.map((entry) => {
      const parsed = parseEventEntry(entry);
      return toCsvRow([parsed.time, parsed.message]);
    });
    return {
      text: [header, ...rows].join('\n'),
      mime: 'text/csv;charset=utf-8;',
      ext: 'csv',
    };
  }

  const payload = {
    exported_at: new Date().toISOString(),
    source: 'WorkflowHub',
    events: eventHistory,
  };
  return {
    text: JSON.stringify(payload, null, 2),
    mime: 'application/json;charset=utf-8;',
    ext: 'json',
  };
}

async function exportEventHistory() {
  if (!eventHistory.length) {
    setExportButtonMicrostate('error', 'No Events');
    toast('No events to export', 'error');
    return;
  }

  const format = document.getElementById('eventExportFormat').value || 'json';
  const { text, mime, ext } = buildEventHistoryExport(format);

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      setExportButtonMicrostate('success', `Copied ${format.toUpperCase()}`);
      toast(`Event history (${format.toUpperCase()}) copied to clipboard`, 'success');
      return;
    }
  } catch {
    // Fall through to file download if clipboard permission fails.
  }

  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workflowhub-event-history-${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setExportButtonMicrostate('success', `Saved ${format.toUpperCase()}`);
  toast(`Event history (${format.toUpperCase()}) downloaded`, 'success');
}

async function copyLastEvent() {
  if (!eventHistory.length) {
    setCopyButtonMicrostate('error');
    toast('No events to copy', 'error');
    return;
  }

  const latest = eventHistory[0];
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(latest);
      setCopyButtonMicrostate('success');
      toast('Latest event copied', 'success');
      return;
    }
  } catch {
    // Fall through to legacy copy fallback.
  }

  const ta = document.createElement('textarea');
  ta.value = latest;
  ta.setAttribute('readonly', 'readonly');
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (ok) {
    setCopyButtonMicrostate('success');
    toast('Latest event copied', 'success');
  } else {
    setCopyButtonMicrostate('error');
    toast('Copy failed in this browser', 'error');
  }
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

function handleGlobalShortcuts(event) {
  if (event.defaultPrevented) return;
  if (isTypingTarget(event.target)) return;

  const isCopyLatestEvent =
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    event.key.toLowerCase() === 'e';

  if (!isCopyLatestEvent) return;
  event.preventDefault();
  copyLastEvent().catch(err => toast(err.message, 'error'));
}

function applyPlatformShortcutHints() {
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '');
  const chord = isMac ? 'Cmd+Shift+E' : 'Ctrl+Shift+E';

  const hint = document.getElementById('shortcutHint');
  if (hint) {
    hint.textContent = `Shortcuts: Copy Last = ${chord}`;
  }

  const copyBtn = document.getElementById('copyLastEventBtn');
  if (copyBtn) {
    copyBtn.setAttribute('title', `Copy latest event (${chord})`);
  }
}

function setCopyButtonMicrostate(kind = 'idle') {
  const btn = document.getElementById('copyLastEventBtn');
  if (!btn) return;

  const baseLabel = 'Copy Last';
  btn.classList.remove('success-state', 'error-state');

  if (kind === 'idle') {
    btn.disabled = false;
    btn.textContent = baseLabel;
    return;
  }

  btn.disabled = true;
  if (kind === 'success') {
    btn.classList.add('success-state');
    btn.textContent = 'Copied';
  } else {
    btn.classList.add('error-state');
    btn.textContent = 'Copy Failed';
  }

  setTimeout(() => {
    setCopyButtonMicrostate('idle');
  }, 1500);
}

function setExportButtonMicrostate(kind = 'idle', label = '') {
  const btn = document.getElementById('exportEventHistoryBtn');
  if (!btn) return;

  const baseLabel = 'Export';
  btn.classList.remove('success-state', 'error-state');

  if (kind === 'idle') {
    btn.disabled = false;
    btn.textContent = baseLabel;
    return;
  }

  btn.disabled = true;
  if (kind === 'success') {
    btn.classList.add('success-state');
    btn.textContent = label || 'Exported';
  } else {
    btn.classList.add('error-state');
    btn.textContent = label || 'Export Failed';
  }

  setTimeout(() => {
    setExportButtonMicrostate('idle');
  }, 1500);
}

function logStatusEvent(message) {
  const line = document.getElementById('statusEventLine');
  const entry = `${message} • ${eventTime()}`;
  if (line) {
    line.textContent = entry;
  }
  eventHistory.unshift(entry);
  if (eventHistory.length > MAX_EVENT_HISTORY) {
    eventHistory.length = MAX_EVENT_HISTORY;
  }
  persistEventHistory();
  renderEventHistory();
}

function updateConnectionHealthUI() {
  const badge = document.getElementById('connectionHealth');
  if (!badge) return;
  const isRetrying = connectionFailureCount >= 2;
  badge.textContent = isRetrying ? 'Retrying' : 'Online';
  badge.classList.toggle('online', !isRetrying);
  badge.classList.toggle('retrying', isRetrying);
}

function markConnectionSuccess() {
  if (connectionFailureCount !== 0) {
    connectionFailureCount = 0;
    updateConnectionHealthUI();
    logStatusEvent('Connection recovered');
  }
  if (autoRefreshEnabled && autoRefreshDelayMs !== AUTO_REFRESH_MS && !autoRefreshPausedByVisibility) {
    autoRefreshDelayMs = AUTO_REFRESH_MS;
    wasRetrying = false;
    scheduleAutoRefreshTick();
    updateAutoRefreshUI();
    logStatusEvent('Auto-refresh recovered to 15s');
  }
}

function markConnectionFailure() {
  connectionFailureCount += 1;
  updateConnectionHealthUI();
  if (connectionFailureCount === 2) {
    logStatusEvent('Connection unstable, retrying');
  }
}

function toast(message, type = 'info', options = {}) {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  const text = document.createElement('span');
  text.textContent = message;
  node.appendChild(text);

  let dismissTimer = null;
  let countdownTimer = null;
  const durationMs = typeof options.durationMs === 'number' ? options.durationMs : 2600;

  const removeToastNode = () => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (node.parentElement) node.parentElement.removeChild(node);
  };

  if (options.actionLabel && typeof options.onAction === 'function') {
    node.classList.add('with-action');
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast-action';
    const actionLabel = String(options.actionLabel);

    const setActionLabel = (remainingMs) => {
      if (options.actionCountdown) {
        const secs = Math.max(1, Math.ceil(remainingMs / 1000));
        actionBtn.textContent = `${actionLabel} ${secs}s`;
      } else {
        actionBtn.textContent = actionLabel;
      }
    };

    setActionLabel(durationMs);

    if (options.actionCountdown) {
      const startedAt = Date.now();
      countdownTimer = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const remaining = durationMs - elapsed;
        if (remaining <= 0) {
          return;
        }
        setActionLabel(remaining);
      }, 1000);
    }

    actionBtn.addEventListener('click', () => {
      options.onAction();
      removeToastNode();
    });
    node.appendChild(actionBtn);
  }

  toastHost.appendChild(node);
  dismissTimer = setTimeout(() => {
    removeToastNode();
  }, durationMs);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${apiBase}${path}`, { ...options, headers });
  } catch {
    markConnectionFailure();
    throw new Error('Cannot reach backend API. Ensure server is running on port 4000.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status >= 500) {
      markConnectionFailure();
      throw new Error('Backend is online but database/auth config is invalid. Check backend/.env DATABASE_URL and DB credentials.');
    }
    throw new Error(body.error || 'Request failed');
  }
  markConnectionSuccess();
  if (res.status === 204) return null;
  return res.json();
}

function setLoggedInUI() {
  authView.classList.add('hidden');
  appView.classList.remove('hidden');
  const user = getUser();
  sessionInfo.textContent = user ? `${user.name} (${user.role})` : '';
  updateAutoRefreshUI();
  updateConnectionHealthUI();
  logStatusEvent('Session ready');
}

function setLoggedOutUI() {
  stopAutoRefresh(false);
  lastRefreshAt = null;
  connectionFailureCount = 0;
  updateAutoRefreshUI();
  updateConnectionHealthUI();
  const pulse = document.getElementById('syncPulse');
  if (pulse) pulse.classList.remove('active');
  logStatusEvent('Signed out');
  appView.classList.add('hidden');
  authView.classList.remove('hidden');
  sessionInfo.textContent = '';
}

function updateAutoRefreshUI() {
  const btn = document.getElementById('autoRefreshBtn');
  const status = document.getElementById('autoRefreshStatus');
  const last = document.getElementById('lastRefreshStatus');
  const live = document.getElementById('liveModeIndicator');
  if (!btn || !status || !last || !live) return;
  btn.textContent = autoRefreshEnabled ? 'Disable Auto-refresh' : 'Enable Auto-refresh';
  if (!autoRefreshEnabled) {
    status.textContent = 'Auto-refresh: Off';
    live.className = 'live-indicator off';
    live.title = 'Live mode off';
  } else if (autoRefreshPausedByVisibility) {
    status.textContent = 'Auto-refresh: Paused (tab hidden)';
    live.className = 'live-indicator paused';
    live.title = 'Live mode paused while tab is hidden';
  } else if (autoRefreshDelayMs > AUTO_REFRESH_MS) {
    status.textContent = `Auto-refresh: Retrying (${Math.floor(autoRefreshDelayMs / 1000)}s)`;
    live.className = 'live-indicator paused';
    live.title = `Live mode retrying every ${Math.floor(autoRefreshDelayMs / 1000)}s`;
  } else {
    status.textContent = 'Auto-refresh: On (15s)';
    live.className = 'live-indicator active';
    live.title = 'Live mode active';
  }
  status.classList.toggle('active', autoRefreshEnabled);
  last.textContent = `Last refresh: ${lastRefreshAt ? formatRefreshTime(lastRefreshAt) : 'never'}`;
}

function formatRefreshTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function markRefreshed() {
  lastRefreshAt = new Date();
  updateAutoRefreshUI();
  pulseSyncIndicator();
}

function pulseSyncIndicator() {
  const pulse = document.getElementById('syncPulse');
  if (!pulse) return;
  pulse.classList.remove('active');
  // Force reflow to restart animation for rapid sequential refreshes.
  void pulse.offsetWidth;
  pulse.classList.add('active');
  setTimeout(() => {
    pulse.classList.remove('active');
  }, 500);
}

async function runAutoRefreshCycle() {
  if (!getToken()) return;
  await Promise.all([
    loadTasks(),
    loadNotifications(),
    loadStats(),
  ]);
  markRefreshed();
}

function stopAutoRefresh(persist = true) {
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = null;
  }
  autoRefreshEnabled = false;
  autoRefreshPausedByVisibility = false;
  autoRefreshDelayMs = AUTO_REFRESH_MS;
  wasRetrying = false;
  if (persist) {
    setAutoRefresh(false);
  }
  updateAutoRefreshUI();
  if (persist) {
    logStatusEvent('Auto-refresh disabled');
  }
}

function scheduleAutoRefreshTick() {
  if (!autoRefreshEnabled || autoRefreshPausedByVisibility) return;
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer);
  }
  autoRefreshTimer = setTimeout(async () => {
    try {
      await runAutoRefreshCycle();
      autoRefreshDelayMs = AUTO_REFRESH_MS;
      wasRetrying = false;
    } catch {
      autoRefreshDelayMs = Math.min(AUTO_REFRESH_MAX_MS, autoRefreshDelayMs * 2);
      if (!wasRetrying && autoRefreshDelayMs > AUTO_REFRESH_MS) {
        wasRetrying = true;
        logStatusEvent(`Auto-refresh retrying every ${Math.floor(autoRefreshDelayMs / 1000)}s`);
      }
    } finally {
      updateAutoRefreshUI();
      scheduleAutoRefreshTick();
    }
  }, autoRefreshDelayMs);
}

function startAutoRefresh() {
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer);
  }
  autoRefreshEnabled = true;
  autoRefreshPausedByVisibility = false;
  autoRefreshDelayMs = AUTO_REFRESH_MS;
  wasRetrying = false;
  setAutoRefresh(true);
  updateAutoRefreshUI();
  scheduleAutoRefreshTick();
  logStatusEvent('Auto-refresh enabled');
}

function toggleAutoRefresh() {
  if (autoRefreshEnabled) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
  }
}

function handleVisibilityChange() {
  if (!autoRefreshEnabled) return;

  if (document.hidden) {
    autoRefreshPausedByVisibility = true;
    if (autoRefreshTimer) {
      clearTimeout(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    updateAutoRefreshUI();
    logStatusEvent('Auto-refresh paused (tab hidden)');
    return;
  }

  if (autoRefreshPausedByVisibility) {
    autoRefreshPausedByVisibility = false;
    updateAutoRefreshUI();
    logStatusEvent('Auto-refresh resumed');
    runAutoRefreshCycle()
      .then(() => {
        autoRefreshDelayMs = AUTO_REFRESH_MS;
        wasRetrying = false;
      })
      .catch(() => {
        autoRefreshDelayMs = Math.min(AUTO_REFRESH_MAX_MS, autoRefreshDelayMs * 2);
        if (!wasRetrying && autoRefreshDelayMs > AUTO_REFRESH_MS) {
          wasRetrying = true;
          logStatusEvent(`Auto-refresh retrying every ${Math.floor(autoRefreshDelayMs / 1000)}s`);
        }
      })
      .finally(() => {
        updateAutoRefreshUI();
        scheduleAutoRefreshTick();
      });
  }
}

async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  setToken(data.token); setUser(data.user);
  autoRefreshEnabled = getAutoRefresh();
  setLoggedInUI();
  await loadUsers();
  await loadStats();
  await loadTasks();
  await loadNotifications();
  markRefreshed();
  if (autoRefreshEnabled) startAutoRefresh();
  toast('Signed in successfully', 'success');
}

async function register() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const name = email.split('@')[0] || 'User';
  const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  setToken(data.token); setUser(data.user);
  autoRefreshEnabled = getAutoRefresh();
  setLoggedInUI();
  await loadUsers();
  await loadStats();
  await loadTasks();
  await loadNotifications();
  markRefreshed();
  if (autoRefreshEnabled) startAutoRefresh();
  toast('Account created and signed in', 'success');
}

async function createTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDescription').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const assigned_to = document.getElementById('taskAssignee').value || undefined;
  if (!title) {
    toast('Title is required', 'error');
    return;
  }
  await api('/tasks', { method: 'POST', body: JSON.stringify({ title, description, priority, assigned_to }) });
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDescription').value = '';
  await loadStats();
  await loadTasks();
  await loadNotifications();
  toast('Task created', 'success');
}

function actionsHtml(task) {
  const statuses = ['submitted', 'in_review', 'approved', 'rejected', 'completed'];
  const options = statuses.map(s => `<option value="${s}" ${task.status === s ? 'selected' : ''}>${s}</option>`).join('');
  return `<select data-action="status" data-id="${task.id}" data-prev="${task.status}" title="Task status">${options}</select> <button data-action="view" data-id="${task.id}" class="secondary">View</button> <button data-action="delete" data-id="${task.id}" class="danger">Delete</button>`;
}

async function loadUsers() {
  const me = getUser();
  if (!me) return;
  try {
    if (me.role === 'admin' || me.role === 'reviewer') {
      usersCache = await api('/users');
    } else {
      usersCache = [me];
    }
  } catch {
    usersCache = [me];
  }

  const options = ['<option value="">Unassigned</option>']
    .concat(usersCache.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.role || 'user')})</option>`))
    .join('');

  document.getElementById('taskAssignee').innerHTML = options;
  document.getElementById('detailAssignee').innerHTML = options;
}

async function loadNotifications() {
  const list = document.getElementById('notificationList');
  const notifications = await api('/notifications');
  if (!notifications.length) {
    list.innerHTML = '<li>No notifications.</li>';
    return;
  }
  list.innerHTML = notifications
    .slice(0, 20)
    .map(n => `<li>${escapeHtml(n.message)} ${n.is_read ? '' : '<strong>(new)</strong>'}<span class="meta">${new Date(n.created_at).toLocaleString()}</span></li>`)
    .join('');
}

async function loadStats() {
  const stats = await api('/tasks/stats');
  const byStatus = Object.fromEntries((stats.by_status || []).map(x => [x.status, parseInt(x.count, 10) || 0]));
  document.getElementById('statTotal').textContent = String(stats.total || 0);
  document.getElementById('statInReview').textContent = String(byStatus.in_review || 0);
  document.getElementById('statApproved').textContent = String(byStatus.approved || 0);
  document.getElementById('statRejected').textContent = String(byStatus.rejected || 0);
}

async function loadTasks() {
  const search = document.getElementById('search').value.trim();
  const status = document.getElementById('statusFilter').value;
  const sortBy = document.getElementById('sortBy').value;
  const sortDir = document.getElementById('sortDir').value;
  updateSortIndicators();
  updateActiveFiltersSummary();
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (quickPriorityFilter) params.set('priority', quickPriorityFilter);
  if (presetAssignedTo) params.set('assigned_to', presetAssignedTo);
  params.set('page', String(currentPage));
  params.set('limit', String(PAGE_SIZE));
  params.set('sort_by', sortBy);
  params.set('sort_dir', sortDir);
  const tbody = document.getElementById('taskTable');
  const emptyState = document.getElementById('taskEmptyState');
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.disabled = true;
  tbody.innerHTML = '<tr class="loading-row"><td colspan="6">Loading tasks...</td></tr>';
  try {
    const data = await api(`/tasks?${params.toString()}`);
    tbody.innerHTML = '';
    for (const t of data.data || []) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(t.title)}</td><td><span class="badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span></td><td><span class="badge ${priorityClass(t.priority)}">${escapeHtml(t.priority)}</span></td><td><span class="activity-time" title="${new Date(t.updated_at || t.created_at).toLocaleString()}">${escapeHtml(relativeTime(t.updated_at || t.created_at))}</span></td><td>${escapeHtml(t.assigned_to_name || '-')}</td><td>${actionsHtml(t)}</td>`;
      tbody.appendChild(tr);
    }

    if ((data.total || 0) === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }

    totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.limit || PAGE_SIZE)));
    if (currentPage > totalPages) {
      currentPage = totalPages;
      return loadTasks();
    }

    const total = data.total || 0;
    const page = data.page || currentPage;
    const limit = data.limit || PAGE_SIZE;
    const start = total > 0 ? (page - 1) * limit + 1 : 0;
    const end = total > 0 ? Math.min(page * limit, total) : 0;
    document.getElementById('resultCountText').textContent = `Showing ${start}-${end} of ${total} tasks`;

    document.getElementById('pageInfo').textContent = `Page ${currentPage} / ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = currentPage <= 1;
    document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;
  } finally {
    refreshBtn.disabled = false;
  }
}

async function loadTaskDetails(taskId) {
  selectedTaskId = taskId;
  const detailLoading = document.getElementById('taskDetailLoading');
  const reassignBtn = document.getElementById('reassignBtn');
  const addCommentBtn = document.getElementById('addCommentBtn');
  detailLoading.classList.remove('hidden');
  reassignBtn.disabled = true;
  addCommentBtn.disabled = true;
  try {
    const [task, comments, history] = await Promise.all([
      api(`/tasks/${taskId}`),
      api(`/tasks/${taskId}/comments`),
      api(`/tasks/${taskId}/history`),
    ]);

    document.getElementById('taskDetailMeta').innerHTML = `${escapeHtml(task.title)} | Status: <span class="badge ${statusClass(task.status)}">${escapeHtml(task.status)}</span> | Priority: <span class="badge ${priorityClass(task.priority)}">${escapeHtml(task.priority)}</span>`;
    document.getElementById('detailAssignee').value = task.assigned_to || '';
    document.getElementById('detailAssignee').setAttribute('data-prev', task.assigned_to || '');

    const commentList = document.getElementById('commentList');
    commentList.innerHTML = comments.length
      ? comments.map(c => `<li>${escapeHtml(c.content)}<span class="meta">${escapeHtml(c.user_name || 'user')} • ${new Date(c.created_at).toLocaleString()}</span></li>`).join('')
      : '<li>No comments yet.</li>';

    const historyList = document.getElementById('historyList');
    historyList.innerHTML = history.length
      ? history.map(h => `<li>${escapeHtml((h.old_status || 'none') + ' → ' + h.new_status)}${h.note ? ': ' + escapeHtml(h.note) : ''}<span class="meta">${escapeHtml(h.changed_by_name || 'user')} • ${new Date(h.created_at).toLocaleString()}</span></li>`).join('')
      : '<li>No history yet.</li>';
  } finally {
    detailLoading.classList.add('hidden');
    reassignBtn.disabled = false;
    addCommentBtn.disabled = false;
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function statusClass(status) {
  return String(status || '').toLowerCase().replace(/[^a-z_]/g, '');
}

function priorityClass(priority) {
  const p = String(priority || '').toLowerCase().replace(/[^a-z]/g, '');
  return `p-${p || 'low'}`;
}

function relativeTime(dateLike) {
  const d = new Date(dateLike);
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function assigneeNameFromId(assignedTo) {
  if (!assignedTo) return '-';
  const u = usersCache.find((x) => x.id === assignedTo);
  return u ? u.name : '-';
}

function updateTaskRowAssignee(taskId, assignedTo) {
  const viewBtn = document.querySelector(`#taskTable [data-action="view"][data-id="${taskId}"]`);
  if (!(viewBtn instanceof HTMLElement)) return;
  const row = viewBtn.closest('tr');
  if (!row || row.children.length < 4) return;
  row.children[3].textContent = assigneeNameFromId(assignedTo);
}

function updateQuickFilterUI(selectedToken = '') {
  for (const chip of document.querySelectorAll('.chip[data-quick-filter]')) {
    const token = chip.getAttribute('data-quick-filter') || '';
    chip.classList.toggle('active', token === selectedToken);
  }
}

async function applyQuickFilter(token) {
  const [key, value] = String(token || '').split(':');
  quickPriorityFilter = '';

  if (key === 'status') {
    document.getElementById('statusFilter').value = value || '';
    updateQuickFilterUI(token);
  } else if (key === 'priority') {
    document.getElementById('statusFilter').value = '';
    quickPriorityFilter = value || '';
    updateQuickFilterUI(token);
  } else {
    return;
  }

  currentPage = 1;
  await loadTasks();
}

async function clearQuickFilters() {
  quickPriorityFilter = '';
  document.getElementById('statusFilter').value = '';
  updateQuickFilterUI('');
  currentPage = 1;
  await loadTasks();
}

async function applyViewPreset(preset) {
  const me = getUser();
  const statusEl = document.getElementById('statusFilter');
  const sortByEl = document.getElementById('sortBy');
  const sortDirEl = document.getElementById('sortDir');

  presetAssignedTo = '';
  quickPriorityFilter = '';
  updateQuickFilterUI('');

  switch (preset) {
    case 'my_queue':
      statusEl.value = '';
      presetAssignedTo = me?.id || '';
      sortByEl.value = 'created_at';
      sortDirEl.value = 'desc';
      break;
    case 'needs_review':
      statusEl.value = 'in_review';
      sortByEl.value = 'created_at';
      sortDirEl.value = 'desc';
      break;
    case 'recently_rejected':
      statusEl.value = 'rejected';
      sortByEl.value = 'created_at';
      sortDirEl.value = 'desc';
      break;
    case 'critical_open':
      statusEl.value = '';
      quickPriorityFilter = 'critical';
      sortByEl.value = 'created_at';
      sortDirEl.value = 'desc';
      break;
    default:
      break;
  }

  setViewPreset(preset);
  currentPage = 1;
  updateSortIndicators();
  await loadTasks();
}

function clearPresetAssignment() {
  presetAssignedTo = '';
  const presetEl = document.getElementById('viewPreset');
  if (presetEl.value) {
    presetEl.value = '';
    setViewPreset('');
  }
}

function updateActiveFiltersSummary() {
  const preset = document.getElementById('viewPreset').value;
  const search = document.getElementById('search').value.trim();
  const status = document.getElementById('statusFilter').value;
  const sortBy = document.getElementById('sortBy').value;
  const sortDir = document.getElementById('sortDir').value;
  const parts = [];

  if (preset) {
    const label = document.querySelector(`#viewPreset option[value="${preset}"]`)?.textContent || preset;
    parts.push(label.replace('View: ', '').trim());
  }
  if (search) parts.push(`Search: ${search}`);
  if (status) parts.push(`Status: ${status}`);
  if (quickPriorityFilter) parts.push(`Priority: ${quickPriorityFilter}`);
  if (presetAssignedTo) parts.push('Assigned: Me');

  const isDefaultSort = sortBy === 'created_at' && sortDir === 'desc';
  if (!isDefaultSort) {
    const sortLabelMap = {
      created_at: 'Created Time',
      updated_at: 'Last Activity',
      title: 'Title',
      priority: 'Priority',
      status: 'Status',
    };
    parts.push(`Sort: ${sortLabelMap[sortBy] || sortBy} (${sortDir === 'asc' ? 'Asc' : 'Desc'})`);
  }

  const text = document.getElementById('activeFiltersText');
  const clearBtn = document.getElementById('clearAllFiltersBtn');
  if (!parts.length) {
    text.textContent = 'No active filters';
    document.getElementById('resultCountText').textContent = 'Showing 0 tasks';
    clearBtn.disabled = true;
    return;
  }

  text.textContent = `Active: ${parts.join(' | ')}`;
  clearBtn.disabled = false;
}

async function clearAllFilters() {
  document.getElementById('search').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('sortBy').value = 'created_at';
  document.getElementById('sortDir').value = 'desc';
  document.getElementById('viewPreset').value = '';

  quickPriorityFilter = '';
  presetAssignedTo = '';
  updateQuickFilterUI('');
  setViewPreset('');

  currentPage = 1;
  updateSortIndicators();
  updateActiveFiltersSummary();
  await loadTasks();
}

async function onTableClick(e) {
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;
  const action = el.getAttribute('data-action');
  const id = el.getAttribute('data-id');
  if (!action || !id) return;
  if (action === 'delete') {
    if (!confirm('Delete task?')) return;
    await api(`/tasks/${id}`, { method: 'DELETE' });
    await loadStats();
    await loadTasks();
    if (selectedTaskId === id) {
      selectedTaskId = null;
      document.getElementById('taskDetailMeta').textContent = 'Select a task from the table to view details.';
      document.getElementById('commentList').innerHTML = '';
      document.getElementById('historyList').innerHTML = '';
    }
    toast('Task deleted', 'success');
    return;
  }

  if (action === 'view') {
    await loadTaskDetails(id);
  }
}

async function onTableChange(e) {
  const el = e.target;
  if (!(el instanceof HTMLSelectElement)) return;
  const action = el.getAttribute('data-action');
  const id = el.getAttribute('data-id');
  if (action !== 'status' || !id) return;

  const previousStatus = el.getAttribute('data-prev') || '';
  const nextStatus = el.value;
  if (!nextStatus || nextStatus === previousStatus) return;

  const row = el.closest('tr');
  const badge = row ? row.querySelector('td:nth-child(2) .badge') : null;
  if (badge) {
    badge.textContent = nextStatus;
    badge.className = `badge ${statusClass(nextStatus)}`;
  }

  el.disabled = true;
  el.classList.add('status-saving');
  try {
    await api(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
    el.setAttribute('data-prev', nextStatus);
    await loadStats();
    await loadTasks();
    if (selectedTaskId === id) await loadTaskDetails(id);
    await loadNotifications();
    toast('Status updated', 'success');
  } catch (err) {
    el.value = previousStatus;
    if (badge) {
      badge.textContent = previousStatus;
      badge.className = `badge ${statusClass(previousStatus)}`;
    }
    throw err;
  } finally {
    el.disabled = false;
    el.classList.remove('status-saving');
  }
}

async function reassignTask() {
  if (!selectedTaskId) {
    toast('Select a task first', 'error');
    return;
  }
  const assigneeEl = document.getElementById('detailAssignee');
  const reassignBtn = document.getElementById('reassignBtn');
  const previousAssigned = assigneeEl.getAttribute('data-prev') || '';
  const nextAssigned = assigneeEl.value || '';
  if (nextAssigned === previousAssigned) return;

  assigneeEl.disabled = true;
  reassignBtn.disabled = true;
  reassignBtn.classList.add('status-saving');
  updateTaskRowAssignee(selectedTaskId, nextAssigned);

  try {
    await api(`/tasks/${selectedTaskId}`, { method: 'PUT', body: JSON.stringify({ assigned_to: nextAssigned || null }) });
    assigneeEl.setAttribute('data-prev', nextAssigned);
    await loadTasks();
    await loadTaskDetails(selectedTaskId);
    await loadNotifications();
    toast('Task reassigned', 'success');
  } catch (err) {
    assigneeEl.value = previousAssigned;
    updateTaskRowAssignee(selectedTaskId, previousAssigned);
    throw err;
  } finally {
    assigneeEl.disabled = false;
    reassignBtn.disabled = false;
    reassignBtn.classList.remove('status-saving');
  }
}

async function addComment() {
  if (!selectedTaskId) {
    toast('Select a task first', 'error');
    return;
  }
  const input = document.getElementById('commentInput');
  const addBtn = document.getElementById('addCommentBtn');
  const content = input.value.trim();
  if (!content) {
    toast('Comment cannot be empty', 'error');
    return;
  }

  const user = getUser();
  const commentList = document.getElementById('commentList');
  if ((commentList.textContent || '').includes('No comments yet.')) {
    commentList.innerHTML = '';
  }

  const tempId = `pending-${Date.now()}`;
  const pending = document.createElement('li');
  pending.className = 'pending-comment';
  pending.setAttribute('data-temp-id', tempId);
  pending.innerHTML = `${escapeHtml(content)}<span class="meta">${escapeHtml(user?.name || 'you')} • sending...</span>`;
  commentList.prepend(pending);

  input.value = '';
  input.disabled = true;
  addBtn.disabled = true;
  addBtn.classList.add('status-saving');

  try {
    await api(`/tasks/${selectedTaskId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
    await loadTaskDetails(selectedTaskId);
    await loadNotifications();
    toast('Comment added', 'success');
  } catch (err) {
    const node = commentList.querySelector(`[data-temp-id="${tempId}"]`);
    if (node) node.remove();
    input.value = content;
    if (!commentList.children.length) {
      commentList.innerHTML = '<li>No comments yet.</li>';
    }
    throw err;
  } finally {
    input.disabled = false;
    addBtn.disabled = false;
    addBtn.classList.remove('status-saving');
  }
}

async function markAllRead() {
  await api('/notifications/read-all', { method: 'PATCH' });
  await loadNotifications();
  toast('Notifications marked as read', 'success');
}

async function generateDemoWorkflow() {
  const me = getUser();
  if (!me) return;

  const templates = [
    { title: 'Quarterly Budget Request', description: 'Prepare and route Q3 budget request for approval.', priority: 'high' },
    { title: 'Vendor Contract Review', description: 'Legal and procurement review for new SaaS vendor contract.', priority: 'medium' },
    { title: 'Security Exception Request', description: 'Review and decide on temporary security policy exception.', priority: 'critical' },
  ];

  const created = [];
  for (const t of templates) {
    const task = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: `${t.title} (${new Date().toLocaleDateString()})`,
        description: t.description,
        priority: t.priority,
      }),
    });
    created.push(task);
  }

  if (created[0]) {
    await api(`/tasks/${created[0].id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'in_review', note: 'Moved into review' }) });
    await api(`/tasks/${created[0].id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'approved', note: 'Approved by manager' }) });
    await api(`/tasks/${created[0].id}/comments`, { method: 'POST', body: JSON.stringify({ content: 'Looks good, approved.' }) });
  }

  if (created[1]) {
    await api(`/tasks/${created[1].id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'in_review', note: 'Legal review started' }) });
    await api(`/tasks/${created[1].id}/comments`, { method: 'POST', body: JSON.stringify({ content: 'Pending signature from vendor.' }) });
  }

  if (created[2]) {
    await api(`/tasks/${created[2].id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'rejected', note: 'Risk too high at this time' }) });
    await api(`/tasks/${created[2].id}/comments`, { method: 'POST', body: JSON.stringify({ content: 'Please resubmit with mitigation plan.' }) });
  }

  await loadStats();
  currentPage = 1;
  await loadTasks();
  await loadNotifications();
  toast('Demo workflow data generated', 'success');
}

async function resetDemoData() {
  if (!confirm('Delete all visible workflow tasks? This action cannot be undone.')) return;

  const search = document.getElementById('search').value.trim();
  const status = document.getElementById('statusFilter').value;
  const baseParams = new URLSearchParams();
  if (search) baseParams.set('search', search);
  if (status) baseParams.set('status', status);

  let deleted = 0;
  while (true) {
    const params = new URLSearchParams(baseParams);
    params.set('page', '1');
    params.set('limit', '100');
    const batch = await api(`/tasks?${params.toString()}`);
    const tasks = batch.data || [];
    if (!tasks.length) break;
    for (const t of tasks) {
      await api(`/tasks/${t.id}`, { method: 'DELETE' });
      deleted++;
    }
  }

  selectedTaskId = null;
  document.getElementById('taskDetailMeta').textContent = 'Select a task from the table to view details.';
  document.getElementById('commentList').innerHTML = '';
  document.getElementById('historyList').innerHTML = '';
  currentPage = 1;
  await loadStats();
  await loadTasks();
  await loadNotifications();
  toast(`Reset complete. Deleted ${deleted} task(s).`, 'success');
}

function toCsvRow(fields) {
  return fields
    .map((f) => `"${String(f ?? '').replace(/"/g, '""')}"`)
    .join(',');
}

async function exportAuditCsv() {
  if (!selectedTaskId) {
    toast('Select a task first', 'error');
    return;
  }

  const history = await api(`/tasks/${selectedTaskId}/history`);
  const header = toCsvRow(['Changed At', 'Changed By', 'Old Status', 'New Status', 'Note']);
  const rows = history.map((h) =>
    toCsvRow([
      new Date(h.created_at).toISOString(),
      h.changed_by_name || h.changed_by || '',
      h.old_status || '',
      h.new_status || '',
      h.note || '',
    ])
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workflowhub-audit-${selectedTaskId}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Audit CSV exported', 'success');
}

async function init() {
  restoreEventHistory();
  restoreLastClearedEventHistory();
  renderEventHistory();
  logStatusEvent('System ready');
  applyPlatformShortcutHints();
  document.addEventListener('keydown', handleGlobalShortcuts);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.getElementById('loginBtn').addEventListener('click', () => login().catch(err => toast(err.message, 'error')));
  document.getElementById('registerBtn').addEventListener('click', () => register().catch(err => toast(err.message, 'error')));
  document.getElementById('createTaskBtn').addEventListener('click', () => createTask().catch(err => toast(err.message, 'error')));
  document.getElementById('refreshBtn').addEventListener('click', () => {
    Promise.all([loadTasks(), loadStats()])
      .then(() => markRefreshed())
      .catch(err => toast(err.message, 'error'));
  });
  document.getElementById('autoRefreshBtn').addEventListener('click', () => toggleAutoRefresh());
  document.getElementById('generateDemoBtn').addEventListener('click', () => generateDemoWorkflow().catch(err => toast(err.message, 'error')));
  document.getElementById('resetDemoBtn').addEventListener('click', () => resetDemoData().catch(err => toast(err.message, 'error')));
  document.getElementById('exportAuditBtn').addEventListener('click', () => exportAuditCsv().catch(err => toast(err.message, 'error')));
  document.getElementById('refreshNotificationsBtn').addEventListener('click', () => {
    loadNotifications()
      .then(() => markRefreshed())
      .catch(err => toast(err.message, 'error'));
  });
  document.getElementById('markAllReadBtn').addEventListener('click', () => markAllRead().catch(err => toast(err.message, 'error')));
  document.getElementById('reassignBtn').addEventListener('click', () => reassignTask().catch(err => toast(err.message, 'error')));
  document.getElementById('addCommentBtn').addEventListener('click', () => addComment().catch(err => toast(err.message, 'error')));
  document.getElementById('logoutBtn').addEventListener('click', () => { clearToken(); clearUser(); setLoggedOutUI(); });
  document.getElementById('search').addEventListener('input', () => {
    clearPresetAssignment();
    currentPage = 1;
    loadTasks().catch(() => {});
  });
  document.getElementById('statusFilter').addEventListener('change', () => {
    quickPriorityFilter = '';
    updateQuickFilterUI('');
    clearPresetAssignment();
    currentPage = 1;
    loadTasks().catch(() => {});
  });
  document.getElementById('sortBy').addEventListener('change', () => {
    clearPresetAssignment();
    currentPage = 1;
    updateSortIndicators();
    loadTasks().catch(() => {});
  });
  document.getElementById('sortDir').addEventListener('change', () => {
    clearPresetAssignment();
    currentPage = 1;
    updateSortIndicators();
    loadTasks().catch(() => {});
  });
  document.getElementById('viewPreset').addEventListener('change', () => {
    const preset = document.getElementById('viewPreset').value;
    applyViewPreset(preset).catch(err => toast(err.message, 'error'));
  });
  document.getElementById('clearAllFiltersBtn').addEventListener('click', () => clearAllFilters().catch(err => toast(err.message, 'error')));
  document.getElementById('emptyClearFiltersBtn').addEventListener('click', () => clearAllFilters().catch(err => toast(err.message, 'error')));
  for (const chip of document.querySelectorAll('.chip[data-quick-filter]')) {
    chip.addEventListener('click', () => {
      const token = chip.getAttribute('data-quick-filter') || '';
      clearPresetAssignment();
      applyQuickFilter(token).catch(err => toast(err.message, 'error'));
    });
  }
  document.getElementById('clearQuickFiltersBtn').addEventListener('click', () => {
    clearPresetAssignment();
    clearQuickFilters().catch(err => toast(err.message, 'error'));
  });
  for (const th of document.querySelectorAll('th.sortable')) {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort');
      if (!field) return;
      toggleSortFromHeader(field).catch(err => toast(err.message, 'error'));
    });
    th.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      const field = th.getAttribute('data-sort');
      if (!field) return;
      toggleSortFromHeader(field).catch(err => toast(err.message, 'error'));
    });
  }
  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      loadTasks().catch(err => toast(err.message, 'error'));
    }
  });
  document.getElementById('nextPageBtn').addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage += 1;
      loadTasks().catch(err => toast(err.message, 'error'));
    }
  });
  document.getElementById('taskTable').addEventListener('click', (e) => onTableClick(e).catch(err => toast(err.message, 'error')));
  document.getElementById('taskTable').addEventListener('change', (e) => onTableChange(e).catch(err => toast(err.message, 'error')));
  document.getElementById('clearEventHistoryBtn').addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const clearToken = clearEventHistory();
    toast('Event history cleared', 'info', {
      actionLabel: 'Undo',
      actionCountdown: true,
      durationMs: 10000,
      onAction: () => {
        if (clearToken !== lastClearToken) {
          toast('Undo expired due to newer clear action', 'error');
          return;
        }
        restoreClearedEventHistory();
        toast('Event history restored', 'success');
      },
    });
  });
  document.getElementById('restoreEventHistoryBtn').addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    restoreClearedEventHistory();
  });
  document.getElementById('copyLastEventBtn').addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyLastEvent().catch(err => toast(err.message, 'error'));
  });
  document.getElementById('exportEventHistoryBtn').addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    exportEventHistory().catch(err => toast(err.message, 'error'));
  });
  updateActiveFiltersSummary();

  if (getToken()) {
    try {
      const me = await api('/auth/me');
      setUser(me);
      autoRefreshEnabled = getAutoRefresh();
      setLoggedInUI();
      updateSortIndicators();
      await loadUsers();
      await loadStats();
      const savedPreset = getViewPreset();
      if (savedPreset) {
        document.getElementById('viewPreset').value = savedPreset;
        await applyViewPreset(savedPreset);
      } else {
        await loadTasks();
      }
      await loadNotifications();
      markRefreshed();
      if (autoRefreshEnabled) {
        startAutoRefresh();
      }
    } catch {
      clearToken(); clearUser(); setLoggedOutUI();
    }
  } else {
    setLoggedOutUI();
  }
}

init();
