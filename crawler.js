const axios = require('axios')
return list[Math.floor(Math.random() * list.length)]
}

async function fetchPage(url) {
    return axios.get(url, { headers: { 'User-Agent': randomUA() } })
}

async function getPhone(url) {
    const { data } = await fetchPage(url)
    const $ = cheerio.load(data)

    const name = $(".specs-phone-name-title").text()
    const image = $(".specs-photo-main img").attr("src")

    let chip = ""
    $(".specs-list tr").each((i, el) => {
        const th = $(el).find("th").text()
        const td = $(el).find("td").text()
        if (th.includes("Chipset")) chip = td
    })

    return { name, chip, image }
}

async function crawl() {
    const db = {}

    const { data } = await fetchPage(BASE + "makers.php3")
    const $ = cheerio.load(data)

    const links = []
    $(".st-text a").each((i, el) => {
        links.push(BASE + $(el).attr("href"))
    })

    for (const l of links.slice(0, 10)) {
        const page = await fetchPage(l)
        const $$ = cheerio.load(page.data)

        const phones = []
        $$(".makers ul li a").each((i, el) => {
            phones.push(BASE + $$(el).attr("href"))
        })

        for (const p of phones.slice(0, 20)) {
            try {
                const d = await getPhone(p)
                db[d.name.toLowerCase()] = d
                console.log("✔", d.name)
                await sleep(1500 + Math.random() * 1500)
            } catch (e) { }
        }
    }

    fs.writeFileSync("devices.json", JSON.stringify(db, null, 2))
}

crawl()
