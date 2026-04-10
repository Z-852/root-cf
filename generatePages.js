const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'devices.json');

let devices;
try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    devices = JSON.parse(raw);
} catch (err) {
    console.error(`❌ 读取或解析 devices.json 失败: ${err.message}`);
    process.exit(1);
}

const pagesDir = path.join(__dirname, 'pages');
if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir, { recursive: true });
}

function slug(s) {
    return s.toLowerCase().replace(/\s+/g, '-');
}

for (const k in devices) {
    const d = devices[k];
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${d.name} Root教程</title>
  <meta name="description" content="${d.name} Root教程">
</head>
<body>
  <h1>${d.name}</h1>
  <img src="${d.image}" width="200" alt="${d.name}">
  <p>芯片：${d.chip}</p>
</body>
</html>`;

    fs.writeFileSync(path.join(pagesDir, `${slug(d.name)}.html`), html);
}

console.log('✅ 静态页面生成完毕');