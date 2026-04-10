const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.gsmarena.com/';
const DEVICES_FILE = path.join(__dirname, 'devices.json');

// ========== 内置备用数据（确保构建永不失败） ==========
const FALLBACK_DEVICES = {
    "samsung galaxy s24 ultra": {
        name: "Samsung Galaxy S24 Ultra",
        chip: "Qualcomm SM8650-AC Snapdragon 8 Gen 3 (4 nm)",
        image: "https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s24-ultra-5g.jpg",
        url: "https://www.gsmarena.com/samsung_galaxy_s24_ultra-12771.php"
    },
    "apple iphone 15 pro max": {
        name: "Apple iPhone 15 Pro Max",
        chip: "Apple A17 Pro (3 nm)",
        image: "https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-15-pro-max.jpg",
        url: "https://www.gsmarena.com/apple_iphone_15_pro_max-12548.php"
    },
    "xiaomi 14 ultra": {
        name: "Xiaomi 14 Ultra",
        chip: "Qualcomm SM8650-AB Snapdragon 8 Gen 3 (4 nm)",
        image: "https://fdn2.gsmarena.com/vv/bigpic/xiaomi-14-ultra.jpg",
        url: "https://www.gsmarena.com/xiaomi_14_ultra-12834.php"
    }
};

// ========== 超丰富 UA 池 ==========
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
];

function randomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== 带指数退避的重试请求（极保守策略） ==========
async function fetchWithRetry(url, maxRetries = 5) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': randomUA(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 25000
            });
            return response;
        } catch (error) {
            lastError = error;
            const status = error.response?.status || 'NET';
            const isRateLimit = status === 429 || status === 403;

            if (attempt === maxRetries - 1) break;

            // 极端保守的退避时间
            let backoff = Math.pow(2, attempt) * 1500; // 1.5s, 3s, 6s, 12s, 24s
            if (isRateLimit) backoff = Math.pow(3, attempt) * 3000; // 3s, 9s, 27s, 81s, 243s (指数3)
            backoff += Math.random() * 3000;

            console.warn(`  ⚠️ [${status}] 等待 ${Math.round(backoff / 1000)}s 后重试 (${attempt + 1}/${maxRetries})`);
            await sleep(backoff);
        }
    }
    throw lastError;
}

// ========== 解析设备详情 ==========
async function getDeviceDetail(url) {
    const response = await fetchWithRetry(url);
    const $ = cheerio.load(response.data);

    const name = $('.specs-phone-name-title').text().trim();
    if (!name) throw new Error('无法解析设备名称');

    const image = $('.specs-photo-main img').attr('src') || '';
    let chip = '';
    $('.specs-list tr').each((i, el) => {
        const th = $(el).find('th').text();
        const td = $(el).find('td').text();
        if (th.includes('Chipset')) chip = td.trim();
    });

    return { name, chip, image, url };
}

// ========== 主流程 ==========
async function crawl() {
    console.log('🐢 开始超保守抓取 (间隔 8-15 秒，遇限加倍等待)...');

    // 读取已有数据实现断点续抓
    let db = {};
    if (fs.existsSync(DEVICES_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
            console.log(`📦 已加载现有设备: ${Object.keys(db).length} 款`);
        } catch (e) { }
    }

    // 抓取品牌列表
    console.log('🔍 获取品牌列表...');
    let makersRes;
    try {
        makersRes = await fetchWithRetry(BASE + 'makers.php3');
    } catch (err) {
        console.error('❌ 无法获取品牌列表，将使用备用数据');
        return useFallback(db);
    }

    const $ = cheerio.load(makersRes.data);
    const brandLinks = [];
    $('.st-text a').each((i, el) => {
        const href = $(el).attr('href');
        if (href) brandLinks.push(BASE + href);
    });

    console.log(`✅ 发现 ${brandLinks.length} 个品牌，仅处理前 10 个以降低风险`);

    // 只处理前 10 个品牌，每个品牌只抓 5 款设备（极低请求量）
    const targetBrands = brandLinks.slice(0, 10);

    for (const [brandIdx, brandUrl] of targetBrands.entries()) {
        console.log(`\n🏭 [品牌 ${brandIdx + 1}/${targetBrands.length}] ${brandUrl}`);

        let brandPage;
        try {
            brandPage = await fetchWithRetry(brandUrl);
        } catch (err) {
            console.error(`  ❌ 跳过品牌`);
            continue;
        }

        const $$ = cheerio.load(brandPage.data);
        const phoneLinks = [];
        $$('.makers ul li a').each((i, el) => {
            const href = $$(el).attr('href');
            if (href) phoneLinks.push(BASE + href);
        });

        console.log(`  📞 发现 ${phoneLinks.length} 款，仅处理前 20 款`);

        const targetPhones = phoneLinks.slice(0, 20);

        for (const [phoneIdx, phoneUrl] of targetPhones.entries()) {
            // 跳过已存在
            const already = Object.values(db).some(d => d.url === phoneUrl);
            if (already) {
                console.log(`  ⏭️ 跳过已抓取`);
                continue;
            }

            try {
                const device = await getDeviceDetail(phoneUrl);
                if (device.name) {
                    db[device.name.toLowerCase()] = device;
                    fs.writeFileSync(DEVICES_FILE, JSON.stringify(db, null, 2));
                    console.log(`  ✔ [${phoneIdx + 1}/5] ${device.name}`);
                }

                // 极慢间隔 8~15 秒
                const wait = 8000 + Math.random() * 7000;
                console.log(`  💤 等待 ${Math.round(wait / 1000)} 秒...`);
                await sleep(wait);

            } catch (err) {
                console.error(`  ✖ 失败: ${err.message}`);
                await sleep(20000);
            }
        }

        // 品牌间休息 30 秒
        if (brandIdx < targetBrands.length - 1) {
            console.log(`\n⏸️  品牌切换，休息 30 秒...`);
            await sleep(30000);
        }
    }

    const count = Object.keys(db).length;
    if (count === 0) {
        return useFallback(db);
    }

    console.log(`\n🎉 成功抓取 ${count} 款设备，保存至 devices.json`);
    return count;
}

function useFallback(existingDb = {}) {
    console.log('⚠️ 抓取数据不足，合并内置备用数据...');
    const merged = { ...FALLBACK_DEVICES, ...existingDb };
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(merged, null, 2));
    console.log(`✅ 使用备用数据，共 ${Object.keys(merged).length} 款设备。`);
    return Object.keys(merged).length;
}

// ========== 执行入口 ==========
crawl().catch(err => {
    console.error('💥 严重错误:', err);
    // 最终兜底：无论如何都写入备用数据
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(FALLBACK_DEVICES, null, 2));
    console.log('🛡️ 已写入备用数据，构建可继续。');
});