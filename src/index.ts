import Koa from "koa"
import Router from "koa-router"
import axios from "axios"
import domino from "domino"
import querystring from "querystring"
import isUrl from "is-url"
import { getMetadata } from "page-metadata-parser"
import { detectEncode } from "./encoding"
import iconv from "iconv-lite"
import { imageRouter } from "./image/imageRouter"

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
          "/": {
            GET: {
              query: {
                url: "take a url of target page.",
              },
            },
          },
          "/svg": {
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

    const r = await axios.get<Buffer>(url, {
      headers: { "User-Agent": "Twitterbot/1.0" },
      responseType: "arraybuffer",
    })
    if (r.status !== 200)
      return Promise.reject(
        ctx.throw(r.status, `remote status code was ${r.statusText}`)
      )
    if (![r.headers["content-type"]].flat().shift()?.startsWith("text/html")) {
      return Promise.reject(ctx.throw(400, "remote content was not html"))
    }
    const buf = r.data

    let html: string
    const encoding = detectEncode(buf)
    if (encoding) {
      html = iconv.decode(buf, encoding)
    } else {
      html = buf.toString("ascii")
    }

    try {
      const { document } = domino.createWindow(html)
      console.log(r.request.url)
      const metadata = getMetadata(document, r.request.url)
      ctx.type = "json"
      ctx.body = metadata
      ctx.set("cache-control", "s-maxage=3600, stale-while-revalidate")
    } catch (error) {
      console.error(error)
      return Promise.reject(ctx.throw(500))
    }
  })

  router.use(imageRouter.routes())

  app.use(router.routes())

  const port = process.env.PORT || 3000

  app.listen(port, () => {
    console.log(`listen on http://localhost:${port}`)
  })
}
main()
