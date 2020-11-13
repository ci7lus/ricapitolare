import Koa from "koa"
import Router from "koa-router"
import fetch from "node-fetch"
import domino from "domino"
import querystring from "querystring"
import isUrl from "is-url"
// @ts-ignore
import { getMetadata } from "page-metadata-parser"
import { detectEncode } from "./encoding"
import iconv from "iconv-lite"

const main = () => {
  const app = new Koa()
  const router = new Router()
  router.options("(.+)", async (ctx) => {
    ctx.status = 204
  })
  router.get("/", async (ctx) => {
    ctx.set("access-control-allow-origin", "*")
    if (typeof ctx.query.url !== "string") {
      ctx.type = "json"
      ctx.body = {
        ricapitolare: {
          request: {
            GET: {
              query: {
                url: "take a url of target page.",
              },
            },
          },
          repository: "https://github.com/ci7lus/ricapitolare",
        },
      }
      ctx.status = 200
      return
    }

    const isAlreadyEscaped = ctx.querystring.includes("%3A%2F%2F") // 環境差異の吸収
    const url = isAlreadyEscaped
      ? encodeURI(ctx.query.url)
      : querystring.parse(ctx.querystring, undefined, undefined, {
          decodeURIComponent: (s) => s,
        }).url
    if (typeof url !== "string")
      return Promise.reject(ctx.throw(500, "url parse error"))
    if (!isUrl(url))
      return Promise.reject(ctx.throw(400, "requested url is not valid"))

    const r = await fetch(url, {
      headers: { "User-Agent": "Twitterbot/1.0" },
    })
    if (!r.ok)
      return Promise.reject(
        ctx.throw(r.status, `remote status code was ${r.status}`)
      )
    if (!r.headers.get("Content-Type")?.startsWith("text/html"))
      return Promise.reject(ctx.throw(400, "remote content was not html"))
    const buf = await r.buffer()

    let html: string
    const encoding = detectEncode(buf)
    if (encoding) {
      html = iconv.decode(buf, encoding)
    } else {
      html = buf.toString("ascii")
    }

    try {
      const { document } = domino.createWindow(html)
      const metadata = getMetadata(document, r.url)
      ctx.type = "json"
      ctx.body = metadata
      ctx.set("cache-control", "s-maxage=3600, stale-while-revalidate")
    } catch (error) {
      console.error(error)
      return Promise.reject(ctx.throw(500))
    }
  })
  app.use(router.routes())

  const port = process.env.PORT || 5000

  app.listen(port, () => {
    console.log(`listen on http://localhost:${port}`)
  })
}
main()
