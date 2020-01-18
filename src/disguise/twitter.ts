import Router from "koa-router"
import { interfaces } from "riassumere"
import { request } from "gaxios"
import { JSDOM } from "jsdom"

const twitterRouter = new Router()

twitterRouter.get("/", async ctx => {
    const uri = ctx.query.uri
    if (typeof uri !== "string") {
        return Promise.reject(ctx.throw(400))
    }

    const req = await request({
        url: uri,
        headers: {
            "User-Agent": "Twitterbot/1.0",
        },
        validateStatus: code => true,
        responseType: "text",
    })

    if (req.status !== 200) {
        return Promise.reject(ctx.throw(500, `remote status code was ${req.status}`))
    } else if (!req.headers["content-type"]?.startsWith("text/html")) {
        return Promise.reject(ctx.throw(500, "remote content was not html"))
    }

    try {
        const resBody = ((req.data as string) || "")
            .replace(/[\r\n]?/g, "")
            .replace(/<script.*?\/script>*/g, "")
            .replace(/<style.*?\/style>*/g, "")
        const dom = new JSDOM(resBody)

        const doc = dom.window.document
        const url = (doc.querySelector("meta[property='og:url']") as HTMLMetaElement | null)?.content || req.request.responseURL

        let icon: string | null = null
        const iconNode = doc.querySelector("link[rel$='icon']") as HTMLLinkElement
        if (iconNode) {
            const urlParsed = new URL(url)
            icon =
                iconNode.href.startsWith("/") && !iconNode.href.startsWith("//")
                    ? `${urlParsed.origin}${iconNode.href}`
                    : iconNode.href
        }

        const body: { [k in keyof interfaces.ISummary & "url"]: string | null } = {
            lang:
                doc.querySelector("html")?.lang ||
                (doc.querySelector("meta[property='og:locale']") as HTMLMetaElement | null)?.content ||
                null,
            url,
            canonical: (doc.querySelector("link[rel='canonical']") as HTMLLinkElement | null)?.href || null,
            icon,
            type:
                (doc.querySelector("meta[property='og:type']") as HTMLMetaElement | null)?.content ||
                (doc.querySelector("meta[property='twitter:type']") as HTMLMetaElement | null)?.content ||
                null,
            site_name:
                (doc.querySelector("meta[property='og:site_name']") as HTMLMetaElement | null)?.content ||
                (doc.querySelector("meta[property='twitter:site']") as HTMLMetaElement | null)?.content ||
                null,
            title:
                (doc.querySelector("meta[property='og:title']") as HTMLMetaElement | null)?.content ||
                (doc.querySelector("meta[property='twitter:title']") as HTMLMetaElement | null)?.content ||
                (doc.querySelector("title") as HTMLTitleElement)?.text ||
                null,
            description:
                (doc.querySelector("meta[property='og:description']") as HTMLMetaElement | null)?.content ||
                (doc.querySelector("meta[property='twitter:description']") as HTMLMetaElement | null)?.content ||
                (doc.querySelector("meta[property='description']") as HTMLMetaElement | null)?.content ||
                null,
            image:
                (doc.querySelector("meta[property='og:image']") as HTMLMetaElement | null)?.content ||
                (doc.querySelector("meta[property='twitter:image']") as HTMLMetaElement | null)?.content ||
                null,
        }
        ctx.type = "json"
        ctx.body = body
    } catch (error) {
        console.error(error)
        return Promise.reject(ctx.throw(500))
    }
})

export { twitterRouter }
