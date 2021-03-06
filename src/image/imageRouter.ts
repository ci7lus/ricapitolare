import querystring from "querystring"
import isUrl from "is-url"
import Router from "koa-router"
import fetch from "node-fetch"
import domino from "domino"
import { detectEncode } from "../encoding"
import { getMetadata } from "page-metadata-parser"
import iconv from "iconv-lite"
import { generateSvg } from "./ogpSvg"
import fs from "fs"
import { join } from "path"
import sharp from "sharp"

const imageRouter = new Router()

imageRouter.get("/svg", async (ctx) => {
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

  if (!url) {
    return ctx.throw(400)
  }
  const borderMode = ctx.query.border !== "no"

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

  let style: string | null = null
  try {
    style = await fs.promises.readFile(
      join(__dirname, "..", "..", "dist", "svg.tailwind.css"),
      "utf8"
    )
  } catch (error) {
    console.error(error)
  }
  if (!style) return ctx.throw(500, "style load failed")

  try {
    const { document } = domino.createWindow(html)
    const metadata = getMetadata(document, r.url)
    const iconUrl = metadata.image || metadata.icon
    let icon: string | undefined
    try {
      if (iconUrl) {
        const r = await fetch(iconUrl, {
          headers: {
            "User-Agent":
              "ricapitolare (+https://github.com/ci7lus/ricapitolare)",
          },
        })
        const mime = r.headers.get("content-type")?.toLowerCase()
        const imageBuff = await r.buffer()
        const buff = await sharp(imageBuff).resize(null, 128).toBuffer()
        icon = `data:${mime};base64,` + buff.toString("base64")
      }
    } catch (error) {}
    const svg = generateSvg({
      style: style.replace(/\<.+\>/g, ""),
      ...metadata,
      icon,
      borderMode,
    })
    ctx.body = svg
    ctx.type = "image/svg+xml"
    ctx.set("cache-control", "s-maxage=3600, stale-while-revalidate")
  } catch (error) {
    console.error(error)
    return Promise.reject(ctx.throw(500))
  }
})

export { imageRouter }
