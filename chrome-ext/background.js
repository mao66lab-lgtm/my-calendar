const CLIENT_ID = '901893770074-kmirlpm14p9m4t0f2b9489uediv18du9.apps.googleusercontent.com';
const CAL = 'https://www.googleapis.com/calendar/v3';

// 建立右鍵選單
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-to-calendar',
    title: '📅 加入行程',
    contexts: ['selection']
  });
});

// 右鍵選單被點擊
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'add-to-calendar') return;

  const text = info.selectionText?.trim();
  if (!text) return;

  const token = await getToken();
  if (!token) {
    notify('請先點擊擴充套件圖示並登入 Google');
    return;
  }

  const parsed = parseImport(text);
  if (!parsed.length) {
    notify('無法解析，請確認格式為：MMDD HHMM 標題');
    return;
  }

  let calList = [];
  try {
    const d = await apiGet(token, `${CAL}/users/me/calendarList`);
    calList = d.items || [];
  } catch(e) {}

  let success = 0;
  for (const p of parsed) {
    try {
      const calId = detectCal(calList, p.title);
      await apiPost(token, `${CAL}/calendars/${encodeURIComponent(calId)}/events`, {
        summary: p.title,
        start: { dateTime: p.start.toISOString() },
        end:   { dateTime: p.end.toISOString() }
      });
      success++;
    } catch(e) { console.error(e); }
  }

  notify(success > 0 ? `✓ 已匯入 ${success} 筆行程` : '匯入失敗，請重試');
});

// 取得儲存的 token
async function getToken() {
  const { gca_token, gca_exp } = await chrome.storage.local.get(['gca_token', 'gca_exp']);
  if (gca_token && gca_exp && Date.now() < gca_exp) return gca_token;
  return null;
}

// 判斷要放哪個日曆
function detectCal(calList, title) {
  const t = title || '';
  const find = name => calList.find(c => c.summary === name)?.id;

  if (/常會|會議|開會|meeting|討論|sync/i.test(t))
    return find('貳貳的會議') || 'primary';
  if (/出門|外出|外食|散步/i.test(t))
    return find('出門') || find('茉央的工作') || 'primary';
  if (/線上活動|online|活動|節目|追劇|看片/i.test(t))
    return find('其他線上活動') || find('貳貳的工作') || 'primary';

  return find('貳貳的直播') || 'primary';
}

// 解析匯入文字（MMDD HHMM[-HHMM] 標題）
function parseImport(raw) {
  const year = new Date().getFullYear();
  const result = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(\d{2})(\d{2})\s+(\d{2})(\d{2})(?:-(\d{2})(\d{2}))?\s+(.+)$/);
    if (!m) continue;
    const [, mo, dy, sh, sm, eh, em, title] = m;
    const start = new Date(year, +mo - 1, +dy, +sh, +sm);
    const dur = /直播|開播|live/i.test(title) ? 3 * 3600000 : 3600000;
    const end = eh ? new Date(year, +mo - 1, +dy, +eh, +em) : new Date(start.getTime() + dur);
    result.push({ title, start, end });
  }
  return result;
}

// API helpers
async function apiGet(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

async function apiPost(token, url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function notify(msg) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png',
    title: '快速加入行程',
    message: msg
  });
}
