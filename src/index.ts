import Koa from "koa"
import Router from "koa-router"
import client from "cheerio-httpcli"
import { URL } from "url"
client.set("headers", { "User-Agent": "Twitterbot/1.0" })

const main = () => {
    const app = new Koa()
    const router = new Router()
    router.options("*", async ctx => {
        ctx.status = 204
    })
    router.get("/", async ctx => {
        ctx.set("access-control-allow-origin", "*")
        const uri = ctx.query.uri
        if (typeof uri !== "string") {
            ctx.type = "json"
            ctx.body = {
                ricapitolare: {
                    GET: {
                        query: {
                            uri: "take uri of remote page.",
                        },
                    },
                },
            }
            ctx.status = 200
            return
        }

        const res = await client.fetch(uri)

        if (res.error) {
            return Promise.reject(ctx.throw(500, `remote status code was ${res.response.statusCode}`))
        } else if (!res.response.headers["content-type"]?.startsWith("text/html")) {
            return Promise.reject(ctx.throw(500, "remote content was not html"))
        }

        try {
            const url = res.$("meta[property='og:url']").attr("content") || res.response.url || uri

            let icon: string | null = null
            const iconNode = res.$("link[rel$='icon']").attr("href")

            if (iconNode) {
                const urlParsed = new URL(url)
                icon = iconNode.startsWith("/") && !iconNode.startsWith("//") ? `${urlParsed.origin}${iconNode}` : iconNode
            }

            const body: {
                lang: string | null
                url: string
                canonical: string | null
                icon: string | null
                type: string | null
                site_name: string | null
                title: string | null
                description: string | null
                image: string | null
            } = {
                lang: res.$("meta[property='og:locale']").attr("content") || res.$("html").attr("lang") || null,
                url,
                canonical: res.$("link[rel='canonical']").attr("href") || null,
                icon,
                type:
                    res.$("meta[property='og:type']").attr("content") ||
                    res.$("meta[property='twitter:type']").attr("content") ||
                    null,
                site_name:
                    res.$("meta[property='og:site_name']").attr("content") ||
                    res.$("meta[property='twitter:site']").attr("content") ||
                    null,
                title:
                    res.$('meta[property="og:title"]').attr("content") ||
                    res.$('meta[property="twitter:title"]').attr("content") ||
                    res.$("title").text() ||
                    null,
                description:
                    res.$('meta[property="og:description"]').attr("content") ||
                    res.$('meta[property="twitter:description"]').attr("content") ||
                    res.$('meta[name="description"]').attr("content") ||
                    null,
                image:
                    res.$('meta[property="og:image"]').attr("content") ||
                    res.$('meta[property="twitter:image"]').attr("content") ||
                    null,
            }
            ctx.type = "json"
            ctx.body = body
            ctx.set("cache-control", "s-maxage=3600, stale-while-revalidate")
        } catch (error) {
            console.error(error)
            return Promise.reject(ctx.throw(500))
        }
    })
    app.use(router.routes())

    const port = process.env.PORT

    app.listen(port || 5000, () => {
        console.log(`listen on http://localhost:${port || 5000}`)
    })
}
main()
