/* =====================================================
   VPS CONTROL CENTER - APP.JS
   ===================================================== */

// ============ CONFIG ============
let CONFIG = {
    ip: '',
    port: 4000,
    token: ''
};

let liveLogInterval = null;
let terminalHistory = [];
let historyIndex = -1;
let deferredInstallPrompt = null;

// ============ PWA ============
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'block';
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'none';
    showToast('✅ Đã cài đặt App thành công!', 'success');
});

function installPWA() {
    if (!deferredInstallPrompt) {
        showToast('Trình duyệt không hỗ trợ hoặc đã cài đặt rồi!', 'info');
        return;
    }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') showToast('🎉 App đã được cài đặt!', 'success');
        deferredInstallPrompt = null;
    });
}

// ============ INIT ============
let dashInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    updateClock();
    setInterval(updateClock, 1000);
    // Register Service Worker cho PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    // Tu dong ket noi neu co settings cu
    if (CONFIG.ip && CONFIG.token) {
        startDashboardPolling();
    }
});

function startDashboardPolling() {
    if (dashInterval) clearInterval(dashInterval);
    loadDashboardStats();
    dashInterval = setInterval(loadDashboardStats, 15000);
}

function updateClock() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleString('vi-VN');
}

// ============ SETTINGS ============
function loadSettings() {
    try {
        const saved = localStorage.getItem('vps_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            CONFIG.ip = parsed.ip || '';
            CONFIG.port = parsed.port || 4000;
            CONFIG.token = parsed.token || '';
        }
    } catch(e) {
        console.warn('Loi doc settings:', e);
    }
    updateConnectionDisplay();
}

function saveSettings() {
    const ip = document.getElementById('settingsIp').value.trim();
    const port = parseInt(document.getElementById('settingsPort').value) || 4000;
    const token = document.getElementById('settingsToken').value.trim();

    if (!ip || !token) {
        showToast('Vui lòng điền đầy đủ thông tin!', 'error');
        return;
    }

    CONFIG.ip = ip;
    CONFIG.port = port;
    CONFIG.token = token;

    // Luu vao localStorage
    localStorage.setItem('vps_config', JSON.stringify({ ip, port, token }));
    updateConnectionDisplay();
    closeSettingsBtn();
    showToast('✅ Đã lưu cài đặt!', 'success');
    startDashboardPolling();
}

function updateConnectionDisplay() {
    if (CONFIG.ip) {
        document.getElementById('connIp').textContent = `${CONFIG.ip}:${CONFIG.port}`;
        setStatusConnecting();
    } else {
        document.getElementById('connIp').textContent = '---';
        document.getElementById('statusDot').className = 'status-dot';
        document.getElementById('statusText').textContent = 'Chưa kết nối';
    }
}

function setStatusOnline() {
    document.getElementById('statusDot').className = 'status-dot online';
    document.getElementById('statusText').textContent = 'Đang kết nối';
}

function setStatusOffline() {
    document.getElementById('statusDot').className = 'status-dot offline';
    document.getElementById('statusText').textContent = 'Mất kết nối';
}

function setStatusConnecting() {
    document.getElementById('statusDot').className = 'status-dot connecting';
    document.getElementById('statusText').textContent = 'Đang kết nối...';
}

function openSettings() {
    // Doc lai tu localStorage de dam bao luon co gia tri moi nhat
    try {
        const saved = localStorage.getItem('vps_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            document.getElementById('settingsIp').value = parsed.ip || CONFIG.ip || '';
            document.getElementById('settingsPort').value = parsed.port || CONFIG.port || 4000;
            document.getElementById('settingsToken').value = parsed.token || CONFIG.token || '';
        } else {
            document.getElementById('settingsIp').value = CONFIG.ip || '';
            document.getElementById('settingsPort').value = CONFIG.port || 4000;
            document.getElementById('settingsToken').value = CONFIG.token || '';
        }
    } catch(e) {
        document.getElementById('settingsIp').value = CONFIG.ip || '';
        document.getElementById('settingsPort').value = CONFIG.port || 4000;
        document.getElementById('settingsToken').value = CONFIG.token || '';
    }
    document.getElementById('settingsModal').classList.add('open');
}

function closeSettings(e) {
    if (e.target.id === 'settingsModal') closeSettingsBtn();
}

function closeSettingsBtn() {
    document.getElementById('settingsModal').classList.remove('open');
}

async function testConnection() {
    const ip = document.getElementById('settingsIp').value.trim();
    const port = document.getElementById('settingsPort').value;
    const token = document.getElementById('settingsToken').value.trim();
    const result = document.getElementById('testResult');

    result.className = '';
    result.textContent = '⏳ Đang kiểm tra...';
    result.style.display = 'block';

    try {
        const res = await fetch(`http://${ip}:${port}/ping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
            signal: AbortSignal.timeout(5000)
        });
        const data = await res.json();
        result.className = 'test-result success';
        result.textContent = `✅ Kết nối thành công! VPS phản hồi: "${data.message}"`;
    } catch (e) {
        result.className = 'test-result error';
        result.textContent = `❌ Kết nối thất bại: ${e.message}`;
    }
}

// ============ API CALLER ============
async function callApi(endpoint, body = {}) {
    if (!CONFIG.ip) {
        openSettings();
        throw new Error('Chưa cấu hình IP VPS');
    }
    const res = await fetch(`http://${CONFIG.ip}:${CONFIG.port}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: CONFIG.token, ...body }),
        signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error(`Lỗi HTTP ${res.status}`);
    return res.json();
}

// ============ TAB NAVIGATION ============
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    const titles = {
        dashboard: 'Dashboard',
        pm2: 'PM2 Manager',
        logs: 'Live Logs',
        editor: 'Code Editor',
        packages: 'Packages',
        terminal: 'Terminal'
    };
    document.getElementById('pageTitle').textContent = titles[tab] || tab;

    if (tab === 'pm2') pm2List();
}

function toggleSidebar() {
    document.body.classList.toggle('sidebar-hidden');
}

function refreshAll() {
    loadDashboardStats();
    showToast('🔄 Đã làm mới!', 'info');
}

// ============ DASHBOARD ============
async function loadDashboardStats() {
    try {
        setStatusConnecting();
        const data = await callApi('/stats');
        setStatusOnline();

        // CPU
        document.getElementById('cpuVal').textContent = data.cpu + '%';
        document.getElementById('cpuBar').style.width = data.cpu + '%';

        // RAM
        document.getElementById('ramVal').textContent = data.ram.used + 'MB';
        document.getElementById('ramBar').style.width = data.ram.percent + '%';

        // Disk
        document.getElementById('diskVal').textContent = data.disk.percent + '%';
        document.getElementById('diskBar').style.width = data.disk.percent + '%';

        // Uptime
        document.getElementById('uptimeVal').textContent = formatUptime(data.uptime);

        // PM2 Process list
        if (data.processes) {
            renderProcessTable('dashProcessBody', data.processes, false);
        }
    } catch (e) {
        setStatusOffline();
    }
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

// ============ PM2 MANAGER ============
async function pm2List() {
    try {
        const data = await callApi('/pm2/list');
        renderProcessTable('pm2TableBody', data.processes, true);
    } catch (e) {
        showToast('❌ Lỗi lấy danh sách PM2: ' + e.message, 'error');
    }
}

function renderProcessTable(tbodyId, processes, showActions) {
    const tbody = document.getElementById(tbodyId);
    if (!processes || processes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Không có tiến trình nào</td></tr>';
        return;
    }

    tbody.innerHTML = processes.map(p => `
        <tr>
            <td>${p.pm_id}</td>
            <td style="color:var(--text-primary);font-weight:600">${p.name}</td>
            <td><span class="badge badge-${p.status === 'online' ? 'online' : p.status === 'stopped' ? 'stopped' : 'offline'}">${p.status}</span></td>
            <td>${p.cpu}%</td>
            <td>${(p.memory / 1024 / 1024).toFixed(1)}MB</td>
            <td>${p.restarts}</td>
            ${showActions ? `
            <td>
                <div style="display:flex;gap:4px">
                    <button class="btn-sm btn-success" onclick="pm2Quick('restart','${p.name}')">▶</button>
                    <button class="btn-sm btn-warning" onclick="pm2Quick('stop','${p.name}')">⏹</button>
                    <button class="btn-sm btn-primary" onclick="quickLogs('${p.name}')">📋</button>
                </div>
            </td>` : ''}
        </tr>
    `).join('');
}

async function pm2Action(action) {
    const name = document.getElementById('pm2ProcessName').value.trim();
    if (!name) { showToast('Vui lòng nhập tên tiến trình!', 'error'); return; }
    await pm2Quick(action, name);
}

async function pm2Quick(action, name) {
    try {
        showToast(`⏳ Đang ${action} "${name}"...`, 'info');
        const data = await callApi('/pm2/action', { action, name });
        const out = document.getElementById('pm2Output');
        out.style.display = 'block';
        out.textContent = data.output || data.message || 'Thực thi thành công!';
        showToast(`✅ ${action} "${name}" thành công!`, 'success');
        setTimeout(pm2List, 1000);
    } catch (e) {
        showToast(`❌ Lỗi: ${e.message}`, 'error');
    }
}

function quickLogs(name) {
    switchTab('logs');
    document.getElementById('logProcessName').value = name;
    fetchLogs();
}

// ============ LIVE LOGS ============
async function fetchLogs() {
    const name = document.getElementById('logProcessName').value.trim() || 'all';
    const lines = parseInt(document.getElementById('logLines').value) || 50;
    try {
        const data = await callApi('/logs/fetch', { name, lines });
        renderLogs(data.logs || []);
        showToast('📋 Đã tải log!', 'info');
    } catch (e) {
        showToast('❌ Lỗi tải log: ' + e.message, 'error');
    }
}

function renderLogs(logs) {
    const viewer = document.getElementById('logViewer');
    if (!logs || logs.length === 0) {
        viewer.innerHTML = '<div class="log-placeholder"><span>📭</span><p>Không có log nào</p></div>';
        return;
    }
    viewer.innerHTML = logs.map(line => {
        let cls = 'normal';
        const lower = line.toLowerCase();
        if (lower.includes('error') || lower.includes('err') || lower.includes('lỗi')) cls = 'error';
        else if (lower.includes('warn')) cls = 'warn';
        else if (lower.includes('success') || lower.includes('✅') || lower.includes('thành công')) cls = 'success';
        else if (lower.includes('info') || lower.includes('🚀') || lower.includes('🔍')) cls = 'info';
        return `<div class="log-line ${cls}">${escapeHtml(line)}</div>`;
    }).join('');
    viewer.scrollTop = viewer.scrollHeight;
    document.getElementById('logCount').textContent = `${logs.length} dòng`;
}

function startLiveLogs() {
    if (liveLogInterval) return;
    document.getElementById('liveBadge').style.display = 'block';
    fetchLogs();
    liveLogInterval = setInterval(fetchLogs, 3000);
    showToast('⚡ Live log đã bắt đầu!', 'success');
}

function stopLiveLogs() {
    if (liveLogInterval) {
        clearInterval(liveLogInterval);
        liveLogInterval = null;
    }
    document.getElementById('liveBadge').style.display = 'none';
    showToast('⏹ Live log đã dừng', 'info');
}

function clearLogs() {
    document.getElementById('logViewer').innerHTML = '<div class="log-placeholder"><span>📋</span><p>Đã xóa log</p></div>';
    document.getElementById('logCount').textContent = '0 dòng';
}

// ============ CODE EDITOR ============
async function loadFile() {
    const path = document.getElementById('editorFilePath').value.trim();
    if (!path) { showToast('Vui lòng nhập đường dẫn file!', 'error'); return; }
    try {
        document.getElementById('editorStatus').textContent = '⏳ Đang đọc file...';
        const data = await callApi('/file/read', { path });
        document.getElementById('codeEditor').value = data.content || '';
        updateLineNumbers();
        document.getElementById('editorStatus').textContent = `✅ Đã mở: ${path}`;
        showToast('📂 Đã mở file thành công!', 'success');
    } catch (e) {
        document.getElementById('editorStatus').textContent = '❌ Lỗi: ' + e.message;
        showToast('❌ Không thể mở file: ' + e.message, 'error');
    }
}

async function saveFile() {
    const path = document.getElementById('editorFilePath').value.trim();
    const content = document.getElementById('codeEditor').value;
    if (!path) { showToast('Vui lòng nhập đường dẫn file!', 'error'); return; }
    try {
        document.getElementById('editorStatus').textContent = '⏳ Đang lưu...';
        await callApi('/file/write', { path, content });
        document.getElementById('editorStatus').textContent = `✅ Đã lưu: ${path}`;
        showToast('💾 Đã lưu file thành công!', 'success');
    } catch (e) {
        document.getElementById('editorStatus').textContent = '❌ Lỗi: ' + e.message;
        showToast('❌ Không thể lưu: ' + e.message, 'error');
    }
}

async function saveAndRestart() {
    await saveFile();
    const processName = prompt('Tên tiến trình PM2 cần restart (vd: seo-agent):');
    if (processName) await pm2Quick('restart', processName);
}

function updateLineNumbers() {
    const editor = document.getElementById('codeEditor');
    const lines = editor.value.split('\n').length;
    document.getElementById('lineNumbers').textContent = Array.from({length: lines}, (_, i) => i + 1).join('\n');
    document.getElementById('editorLines').textContent = `Dòng: ${lines}`;
}

// ============ PACKAGES ============
async function installPackage() {
    const pkgName = document.getElementById('pkgName').value.trim();
    const workdir = document.getElementById('pkgWorkdir').value.trim() || '/root/seo-scraper';
    if (!pkgName) { showToast('Vui lòng nhập tên thư viện!', 'error'); return; }
    await runPackageCommand(`npm install ${pkgName}`, workdir);
}

async function listPackages() {
    const workdir = document.getElementById('pkgWorkdir').value.trim() || '/root/seo-scraper';
    await runPackageCommand('npm list --depth=0', workdir);
}

async function quickInstall(pkg) {
    const workdir = document.getElementById('pkgWorkdir').value.trim() || '/root/seo-scraper';
    await runPackageCommand(`npm install ${pkg}`, workdir);
}

async function runPackageCommand(cmd, cwd) {
    const output = document.getElementById('pkgOutput');
    output.innerHTML = '<span style="color:var(--warning)">⏳ Đang thực thi: ' + escapeHtml(cmd) + '...</span>\n';
    try {
        const data = await callApi('/exec', { command: cmd, cwd });
        output.textContent = data.output || 'Hoàn thành!';
        showToast('✅ Thực thi xong!', 'success');
    } catch (e) {
        output.textContent = '❌ Lỗi: ' + e.message;
        showToast('❌ Lỗi: ' + e.message, 'error');
    }
}

// ============ TERMINAL ============
async function execCommand() {
    const input = document.getElementById('terminalInput');
    const cmd = input.value.trim();
    if (!cmd) return;

    terminalHistory.unshift(cmd);
    historyIndex = -1;
    input.value = '';

    appendTerminalLine(`$ ${cmd}`, 'terminal-cmd-line');
    appendTerminalLine('─'.repeat(50), 'terminal-separator');

    try {
        const data = await callApi('/exec', { command: cmd });
        const lines = (data.output || '').split('\n');
        lines.forEach(line => appendTerminalLine(line, 'terminal-result-line'));
    } catch (e) {
        appendTerminalLine('❌ ' + e.message, 'terminal-error-line');
    }

    appendTerminalLine('', 'terminal-result-line');
    scrollTerminal();
}

function runQuickCmd(cmd) {
    document.getElementById('terminalInput').value = cmd;
    execCommand();
}

function appendTerminalLine(text, cls) {
    const out = document.getElementById('terminalOutput');
    const div = document.createElement('div');
    div.className = `terminal-output-line ${cls}`;
    div.textContent = text;
    out.appendChild(div);
}

function scrollTerminal() {
    const screen = document.getElementById('terminalScreen');
    screen.scrollTop = screen.scrollHeight;
}

function clearTerminal() {
    document.getElementById('terminalOutput').innerHTML = '';
}

function handleTerminalKey(e) {
    if (e.key === 'Enter') {
        execCommand();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < terminalHistory.length - 1) {
            historyIndex++;
            document.getElementById('terminalInput').value = terminalHistory[historyIndex];
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            document.getElementById('terminalInput').value = terminalHistory[historyIndex];
        } else {
            historyIndex = -1;
            document.getElementById('terminalInput').value = '';
        }
    }
}

// ============ TOAST ============
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============ UTILS ============
function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
