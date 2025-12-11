import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import domino from "domino";
import iconv from "iconv-lite";
import isUrl from "is-url";
import { getMetadata } from "page-metadata-parser";
import { version } from "../package.json";
import { detectEncode } from "../src/encoding";
import swagger from "../src/swagger.json";

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
	if (typeof req.query.url !== "string") {
		swagger.info.version = version;
		return res.status(200).json(swagger);
	}

	const url = req.query.url;
	if (typeof url !== "string") {
		return res.status(500).json({ message: "url parse error" });
	}
	if (!isUrl(url)) {
		return res.status(400).json({ message: "requested url is not valid" });
	}

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

	try {
		const { document } = domino.createWindow(html);
		const metadata = getMetadata(document, r.request?.res?.responseUrl || url);
		res.setHeader("cache-control", "s-maxage=3600, stale-while-revalidate");
		return res.status(200).json(metadata);
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "parse error" });
	}
}
