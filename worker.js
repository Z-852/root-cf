export default {
    async fetch(req, env) {
        const url = new URL(req.url)

        if (url.pathname.startsWith('/api')) {
            const name = url.searchParams.get('name')
            const data = await env.DEVICES.get(name)

            return new Response(data, {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "max-age=3600"
                }
            })
        }

        return fetch(req)
    }
}
