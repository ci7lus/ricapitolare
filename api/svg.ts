import fs from "node:fs";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import sharp from "sharp";
import { generateSvg } from "../src/image/ogpSvg";
import {
	fetchPageMetadata,
	type IPageMetadata,
	MetadataParseError,
} from "../src/metadata";

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
	const urlStr = req.query.url;
	if (typeof urlStr !== "string") {
		return res.status(500).json({ message: "url parse error" });
	}
	let url: URL;
	try {
		url = new URL(urlStr);
	} catch (error) {
		console.error(error);
		return res.status(400).json({ message: "requested url is not valid" });
	}
	if (!["http:", "https:"].includes(url.protocol)) {
		return res.status(400).json({ message: "requested url is not valid" });
	}
	const borderMode = req.query.border !== "no";

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
		const { metadata, responseUrl } = await fetchPageMetadata(url.href);
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
				const buff = await sharp(r.data).resize(null, 128).toBuffer();
				icon = `data:${mime};base64,${buff.toString("base64")}`;
			}
		} catch (error) {
			console.error(error);
		}
		const svg = generateSvg({
			style,
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
		const dummyMetadata: IPageMetadata = {
			url: url.href,
			title: "Failed to fetch the page",
			provider: "ricapitolare",
		};
		if (error instanceof MetadataParseError) {
			dummyMetadata.description = `StatusCode: ${error.statusCode}`;
		}
		const svg = generateSvg({
			style,
			borderMode,
			...dummyMetadata,
		});
		res.setHeader("content-type", "image/svg+xml");
		return res.status(500).send(svg).end();
	}
}
