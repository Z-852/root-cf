const fs2 = require('fs')
const devices = JSON.parse(fs2.readFileSync('devices.json'))

function slug(s) { return s.toLowerCase().replace(/\s+/g, '-') }

for (const k in devices) {
    const d = devices[k]

    const html = `
  <html>
  <head>
    <title>${d.name} Root教程</title>
    <meta name="description" content="${d.name} Root教程">
  </head>
  <body>
    <h1>${d.name}</h1>
    <img src="${d.image}" width="200">
    <p>芯片：${d.chip}</p>
  </body>
  </html>`

    fs2.writeFileSync(`pages/${slug(d.name)}.html`, html)
}
