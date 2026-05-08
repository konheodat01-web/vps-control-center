/**
 * VPS MANAGER - BACKEND (vps-manager.js)
 * Cài đặt trên VPS: node vps-manager.js
 * Hoặc dùng PM2: pm2 start vps-manager.js --name vps-manager
 * 
 * Cài thư viện: npm install express cors
 */

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

// ======================================================
// THAY ĐỔI TOKEN NÀY TRƯỚC KHI SỬ DỤNG!
// ======================================================
const SECRET_ADMIN_TOKEN = "VPS_ADMIN_2024_SUPER_SECRET";
const PORT = 4000;

// Giới hạn lệnh được phép chạy (Bảo mật)
const BLOCKED_COMMANDS = ['rm -rf /', 'mkfs', 'dd if=/dev/zero', 'shutdown', 'reboot', 'halt'];

// ============ MIDDLEWARE BẢO MẬT ============
function auth(req, res, next) {
    const { token } = req.body;
    if (token !== SECRET_ADMIN_TOKEN) {
        return res.status(403).json({ error: "Token không hợp lệ" });
    }
    next();
}

function execCmd(command, cwd) {
    return new Promise((resolve, reject) => {
        const isBlocked = BLOCKED_COMMANDS.some(cmd => command.includes(cmd));
        if (isBlocked) {
            reject(new Error("Lệnh này bị chặn vì lý do bảo mật!"));
            return;
        }
        const options = { timeout: 30000 };
        if (cwd) options.cwd = cwd;
        exec(command, options, (err, stdout, stderr) => {
            resolve({ output: stdout || stderr || '', error: err ? err.message : null });
        });
    });
}

// ============ API ENDPOINTS ============

// 1. PING - Kiểm tra kết nối
app.post('/ping', auth, (req, res) => {
    res.json({ message: "VPS Manager đang hoạt động!", time: new Date().toISOString() });
});

// 2. STATS - Thông tin hệ thống
app.post('/stats', auth, async (req, res) => {
    try {
        // CPU
        const cpuResult = await execCmd("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
        const cpu = parseFloat(cpuResult.output.trim()) || 0;

        // RAM
        const totalMem = Math.round(os.totalmem() / 1024 / 1024);
        const freeMem = Math.round(os.freemem() / 1024 / 1024);
        const usedMem = totalMem - freeMem;
        const ramPercent = Math.round((usedMem / totalMem) * 100);

        // Disk
        const diskResult = await execCmd("df -h / | tail -1 | awk '{print $5}' | tr -d '%'");
        const diskPercent = parseInt(diskResult.output.trim()) || 0;

        // Uptime (giây)
        const uptime = Math.round(os.uptime());

        // PM2 Processes
        const pm2Result = await execCmd("pm2 jlist");
        let processes = [];
        try {
            processes = JSON.parse(pm2Result.output).map(p => ({
                pm_id: p.pm_id,
                name: p.name,
                status: p.pm2_env.status,
                cpu: p.monit ? p.monit.cpu : 0,
                memory: p.monit ? p.monit.memory : 0,
                restarts: p.pm2_env.restart_time || 0
            }));
        } catch (e) { processes = []; }

        res.json({
            cpu: Math.round(cpu),
            ram: { used: usedMem, total: totalMem, percent: ramPercent },
            disk: { percent: diskPercent },
            uptime,
            processes
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. PM2 - Danh sách tiến trình
app.post('/pm2/list', auth, async (req, res) => {
    try {
        const result = await execCmd("pm2 jlist");
        let processes = [];
        try {
            processes = JSON.parse(result.output).map(p => ({
                pm_id: p.pm_id,
                name: p.name,
                status: p.pm2_env.status,
                cpu: p.monit ? p.monit.cpu : 0,
                memory: p.monit ? p.monit.memory : 0,
                restarts: p.pm2_env.restart_time || 0
            }));
        } catch (e) { processes = []; }
        res.json({ processes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. PM2 - Hành động (restart, stop, start, delete)
app.post('/pm2/action', auth, async (req, res) => {
    const { action, name } = req.body;
    const allowedActions = ['restart', 'stop', 'start', 'delete', 'reload'];
    if (!allowedActions.includes(action)) {
        return res.status(400).json({ error: "Hành động không hợp lệ" });
    }
    try {
        const result = await execCmd(`pm2 ${action} ${name}`);
        res.json({ output: result.output, message: `Đã ${action} "${name}" thành công!` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. LOGS - Xem log PM2
app.post('/logs/fetch', auth, async (req, res) => {
    const { name, lines } = req.body;
    const lineCount = Math.min(parseInt(lines) || 50, 500); // Tối đa 500 dòng
    try {
        let command;
        if (name === 'all') {
            command = `pm2 logs --lines ${lineCount} --nostream 2>&1 || cat ~/.pm2/logs/*.log 2>&1 | tail -${lineCount}`;
        } else {
            command = `pm2 logs ${name} --lines ${lineCount} --nostream 2>&1`;
        }
        const result = await execCmd(command);
        const logs = result.output.split('\n').filter(l => l.trim());
        res.json({ logs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 6. FILE - Đọc file
app.post('/file/read', auth, (req, res) => {
    const { path } = req.body;

    // Bảo mật: Chỉ cho đọc file trong /root (không cho đọc /etc/passwd v.v...)
    if (!path || path.includes('..') || (!path.startsWith('/root') && !path.startsWith('/home'))) {
        return res.status(403).json({ error: "Đường dẫn không được phép!" });
    }

    try {
        const content = fs.readFileSync(path, 'utf8');
        res.json({ content });
    } catch (e) {
        res.status(500).json({ error: `Không thể đọc file: ${e.message}` });
    }
});

// 7. FILE - Ghi file
app.post('/file/write', auth, (req, res) => {
    const { path, content } = req.body;

    // Bảo mật: Chỉ cho ghi file trong /root
    if (!path || path.includes('..') || (!path.startsWith('/root') && !path.startsWith('/home'))) {
        return res.status(403).json({ error: "Đường dẫn không được phép!" });
    }

    try {
        // Backup file cũ trước khi ghi
        if (fs.existsSync(path)) {
            fs.copyFileSync(path, path + '.backup');
        }
        fs.writeFileSync(path, content, 'utf8');
        res.json({ message: `Đã lưu file: ${path}` });
    } catch (e) {
        res.status(500).json({ error: `Không thể lưu file: ${e.message}` });
    }
});

// 8. EXEC - Chạy lệnh Linux tùy ý
app.post('/exec', auth, async (req, res) => {
    const { command, cwd } = req.body;
    if (!command) return res.status(400).json({ error: "Thiếu lệnh" });

    try {
        const result = await execCmd(command, cwd);
        res.json({ output: result.output, error: result.error });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║    🚀 VPS MANAGER đã khởi động!        ║');
    console.log(`║    📡 Cổng: ${PORT}                         ║`);
    console.log(`║    🔑 Token: ${SECRET_ADMIN_TOKEN.substring(0, 10)}...  ║`);
    console.log('╚════════════════════════════════════════╝');
    console.log('');
});
