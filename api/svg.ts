import fs from "node:fs";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import domino from "domino";
import iconv from "iconv-lite";
import isUrl from "is-url";
import { getMetadata } from "page-metadata-parser";
import sharp from "sharp";
import { detectEncode } from "../src/encoding";
import { generateSvg } from "../src/image/ogpSvg";

export default async function (req: VercelRequest, res: VercelResponse) {
	res.setHeader("access-control-allow-origin", "*");
	if (req.method === "OPTIONS") {
		res.setHeader("access-control-allow-methods", "GET, OPTIONS");
		res.setHeader("access-control-allow-headers", "*");
		res.setHeader("access-control-max-age", "86400");
		res.statusCode = 204;
		res.end();
		return;
	}
	const url = req.query.url;
	if (typeof url !== "string") {
		return res.status(500).json({ message: "url parse error" });
	}
	if (!isUrl(url)) {
		return res.status(400).json({ message: "requested url is not valid" });
	}
	const borderMode = req.query.border !== "no";

	const r = await axios.get<Buffer>(encodeURI(url), {
		headers: { "User-Agent": "Twitterbot/1.0" },
		responseType: "arraybuffer",
		validateStatus: () => true,
	});
	if (r.status !== 200) {
		return res
			.status(r.status)
			.json({ message: `remote status code was ${r.status}` });
	}
	if (![r.headers["content-type"]].flat().shift()?.startsWith("text/html")) {
		return res.status(400).json({ message: "remote content was not html" });
	}
	const buf = r.data;

	let html: string;
	const encoding = detectEncode(buf);
	if (encoding) {
		html = iconv.decode(buf, encoding);
	} else {
		html = buf.toString("ascii");
	}

	let style: string | null = null;
	try {
		style = await fs.promises.readFile("./svg.tailwind.css", "utf8");
	} catch (error) {
		console.error(error);
	}
	if (!style) {
		return res.status(500).json({ message: "style load failed" });
	}

	try {
		const { document } = domino.createWindow(html);
		const responseUrl = r.request.res.responseUrl || url;
		const metadata = getMetadata(document, responseUrl) as {
			title: string;
			image: string;
			icon: string;
		};
		const iconUrl = metadata.image || metadata.icon;
		let icon: string | undefined;
		try {
			if (iconUrl) {
				const r = await axios.get<Buffer>(iconUrl, {
					headers: {
						"User-Agent":
							"ricapitolare (+https://github.com/ci7lus/ricapitolare)",
					},
					responseType: "arraybuffer",
				});
				const mime = [r.headers["content-type"]].flat().shift()?.toLowerCase();
				const buff = await sharp(r.data).resize(null, 256).toBuffer();
				icon = `data:${mime};base64,${buff.toString("base64")}`;
			}
		} catch (error) {
			console.error(error);
		}
		const svg = generateSvg({
			style: style.replace(/<.+>/g, ""),
			...metadata,
			icon,
			borderMode,
			url: responseUrl,
		});
		res.setHeader("content-type", "image/svg+xml");
		res.setHeader("cache-control", "s-maxage=3600, stale-while-revalidate");
		return res.status(200).send(svg).end();
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "parse error" });
	}
}
