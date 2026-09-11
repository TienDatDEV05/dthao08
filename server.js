const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
};

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const server = http.createServer((req, res) => {
    // CORS headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') {
        reqPath = '/index.html';
    }

    const filePath = path.join(ROOT_DIR, reqPath);

    // Security check: prevent directory traversal
    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h2>404 - Không tìm thấy tệp: ${reqPath}</h2>`);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

// ========================================================
// BACKGROUND PUSH SCHEDULER
// Tự động kích hoạt kiểm tra lịch học & gửi Web Push mỗi 60 giây
// Giúp nhận thông báo ngay cả khi đóng hoàn toàn ứng dụng và khóa màn hình
// ========================================================
const SUPABASE_PUSH_ENDPOINT = 'https://qwvhudppdoauivpdewin.supabase.co/functions/v1/send-push';

function runPushScheduler() {
    try {
        const postData = JSON.stringify({ action: 'check_schedules' });
        const url = new URL(SUPABASE_PUSH_ENDPOINT);

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const result = JSON.parse(responseBody);
                        if (result.totalSent > 0) {
                            const timeStr = new Date().toLocaleTimeString('vi-VN');
                            console.log(`[${timeStr}] 🔔 Push Scheduler: Đã gửi ${result.totalSent} thông báo đẩy tới thiết bị khóa màn hình!`);
                        }
                    } catch (_) {}
                }
            });
        });

        req.on('error', () => {
            // Xử lý im lặng khi mạng chập chờn, không ngắt server
        });

        req.on('timeout', () => {
            req.destroy();
        });

        req.write(postData);
        req.end();
    } catch (_) {}
}

server.listen(PORT, () => {
    const localIp = getLocalIp();
    console.log('\n========================================================');
    console.log('🚀 ĐOÀN THẢO PERSONAL SPACE - DEV SERVER ĐANG CHẠY!');
    console.log('========================================================');
    console.log(`💻 Mở trên máy tính này : http://localhost:${PORT}`);
    console.log(`📱 Mở trên điện thoại   : http://${localIp}:${PORT} (cùng mạng Wi-Fi)`);
    console.log('🔔 Bộ lập lịch Push      : Đang chạy nền (quét mỗi 60s)');
    console.log('--------------------------------------------------------');
    console.log('💡 Nhấn phím Ctrl + C trong terminal để dừng server.');
    console.log('========================================================\n');

    // Chạy scheduler sau 5 giây và duy trì mỗi 60 giây
    setTimeout(runPushScheduler, 5000);
    setInterval(runPushScheduler, 60000);
});
