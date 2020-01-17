import Router from "koa-router"
import $ from "transform-ts"
import { request } from "gaxios"
import { JSDOM } from "jsdom"

const twitterRouter = new Router()

twitterRouter.get("/", async ctx => {
    try {
        const uri = $.string.transformOrThrow(ctx.query.uri)

        const parsedUri = new URL(uri)

        const req = await request({
            url: uri,
            headers: {
                "User-Agent": "Twitterbot/1.0",
            },
            validateStatus: code => true,
            responseType: "text",
        })

        const resBody = ((req.data as string) || "")
            .replace(/[\r\n]?/g, "")
            .replace(/<script.*?\/script>*/g, "")
            .replace(/<style.*?\/style>*/g, "")
        const dom = new JSDOM(resBody)

        let lang: string | null = null
        const htmlNode: HTMLHtmlElement | null = dom.window.document.querySelector("html")
        if (htmlNode) {
            lang = htmlNode.lang
        }

        let title: string | null = null
        const titleNodes: HTMLTitleElement[] = Array.from(dom.window.document.querySelectorAll("title"))
        if (titleNodes) {
            title = titleNodes.sort((a, b) => b.text.length - a.text.length)[0].text
        }

        const metadata: HTMLMetaElement[] = Array.from(dom.window.document.querySelectorAll("meta"))

        let description: string | null = null
        const descriptionNode = metadata.find(datum => datum.name === "description")
        if (descriptionNode) {
            description = descriptionNode.content
        }

        const og = new Map(
            metadata
                .filter(datum => datum.name.startsWith("og:") || datum.getAttribute("property")?.startsWith("og:"))
                .map(datum => [(datum.name || datum.getAttribute("property") || "").replace("og:", ""), datum.content])
        )
        const url = og.get("url") || req.request.responseURL
        const type = og.get("type") || null
        const siteName = og.get("site_name") || null
        const image = og.get("image") || null

        const links: HTMLLinkElement[] = Array.from(dom.window.document.querySelectorAll("link"))

        let icon: string | null = null
        const iconNode = links.find(link => link.rel === "icon" || link.rel === "apple-touch-icon")
        if (iconNode) {
            const urlParsed = new URL(url)
            icon =
                iconNode.href.startsWith("/") && !iconNode.href.startsWith("//")
                    ? `${urlParsed.origin}${iconNode.href}`
                    : iconNode.href
        }
        let canonical: string | null = null
        const canonicalNode = links.find(link => link.rel === "canonical")
        if (canonicalNode) {
            canonical = canonicalNode.href
        }

        const card = new Map(
            metadata
                .filter(datum => datum.name.startsWith("twitter:") || datum.getAttribute("property")?.startsWith("twitter:"))
                .map(datum => [
                    (datum.name || datum.getAttribute("property") || "").replace("twitter:", ""),
                    datum.content || datum.getAttribute("value"),
                ])
        )

        const body = {
            lang,
            url,
            canonical,
            icon,
            type: type || card.get("type") || null,
            site_name: siteName || card.get("site") || null,
            title: title || card.get("title") || null,
            description: description || card.get("description") || null,
            image: image || card.get("image") || null,
        }
        ctx.type = "json"
        ctx.body = body
    } catch (error) {
        ctx.throw(400)
    }
})

export { twitterRouter }
