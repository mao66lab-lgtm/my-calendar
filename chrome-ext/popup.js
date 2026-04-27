const CLIENT_ID = '901893770074-kmirlpm14p9m4t0f2b9489uediv18du9.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

const statusEl  = document.getElementById('status');
const btn       = document.getElementById('btn');
const noteEl    = document.getElementById('setup-note');

async function checkStatus() {
  const { gca_token, gca_exp } = await chrome.storage.local.get(['gca_token', 'gca_exp']);
  if (gca_token && gca_exp && Date.now() < gca_exp) {
    statusEl.textContent = '✓ 已登入';
    statusEl.className = 'status ok';
    btn.textContent = '重新登入';
  } else {
    statusEl.textContent = '尚未登入';
    statusEl.className = 'status';
    btn.textContent = '登入 Google';
  }
}

btn.addEventListener('click', () => {
  const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
  const authUrl =
    `https://accounts.google.com/o/oauth2/auth` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&prompt=select_account`;

  chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUrl) => {
    if (chrome.runtime.lastError || !redirectUrl) {
      // 可能是 redirect URI 未加入 Google Cloud Console
      const id = chrome.runtime.id;
      noteEl.style.display = 'block';
      noteEl.innerHTML =
        `需要先到 <a href="#" onclick="chrome.tabs.create({url:'https://console.cloud.google.com/apis/credentials'})">Google Cloud Console</a> → 你的 OAuth 憑證 → 新增「已授權重新導向 URI」：<br>` +
        `<code style="word-break:break-all;font-size:10px">https://${id}.chromiumapp.org/</code>`;
      statusEl.textContent = '登入失敗，請看下方說明';
      return;
    }

    const hash = new URL(redirectUrl).hash;
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in') || '3600');

    if (token) {
      const exp = Date.now() + (expiresIn - 60) * 1000;
      chrome.storage.local.set({ gca_token: token, gca_exp: exp });
      statusEl.textContent = '✓ 已登入';
      statusEl.className = 'status ok';
      btn.textContent = '重新登入';
      noteEl.style.display = 'none';
    }
  });
});

checkStatus();
