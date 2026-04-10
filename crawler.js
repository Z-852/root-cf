const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const BASE = 'https://www.gsmarena.com/';

// 模拟随机 User-Agent
function randomUA() {
    const list = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ];
    return list[Math.floor(Math.random() * list.length)];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
    return axios.get(url, { headers: { 'User-Agent': randomUA() } });
}

async function getPhone(url) {
    const { data } = await fetchPage(url);
    const $ = cheerio.load(data);

    const name = $('.specs-phone-name-title').text().trim();
    const image = $('.specs-photo-main img').attr('src');

    let chip = '';
    $('.specs-list tr').each((i, el) => {
        const th = $(el).find('th').text();
        const td = $(el).find('td').text();
        if (th.includes('Chipset')) chip = td.trim();
    });

    return { name, chip, image };
}

async function crawl() {
    const db = {};

    const { data } = await fetchPage(BASE + 'makers.php3');
    const $ = cheerio.load(data);

    const links = [];
    $('.st-text a').each((i, el) => {
        links.push(BASE + $(el).attr('href'));
    });

    for (const l of links.slice(0, 10)) {
        const page = await fetchPage(l);
        const $$ = cheerio.load(page.data);

        const phones = [];
        $$('.makers ul li a').each((i, el) => {
            phones.push(BASE + $$(el).attr('href'));
        });

        for (const p of phones.slice(0, 20)) {
            try {
                const d = await getPhone(p);
                if (d.name) {
                    db[d.name.toLowerCase()] = d;
                    console.log('✔', d.name);
                }
                await sleep(1500 + Math.random() * 1500);
            } catch (e) {
                console.error('获取失败:', p, e.message);
            }
        }
    }

    fs.writeFileSync('devices.json', JSON.stringify(db, null, 2));
    console.log(`✅ 成功抓取 ${Object.keys(db).length} 款设备，已保存至 devices.json`);
}

crawl();