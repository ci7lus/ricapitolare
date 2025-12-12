import type { VercelRequest, VercelResponse } from "@vercel/node";
import { version } from "../package.json";
import { fetchPageMetadata, MetadataParseError } from "../src/metadata";
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

	const urlStr = req.query.url;
	if (typeof urlStr !== "string") {
		swagger.info.version = version;
		res.setHeader("cache-control", "s-maxage=3600, stale-while-revalidate");
		return res.status(200).json(swagger);
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

	try {
		const { metadata } = await fetchPageMetadata(url.href);
		res.setHeader("cache-control", "s-maxage=3600, stale-while-revalidate");
		return res.status(200).json(metadata);
	} catch (error) {
		if (error instanceof MetadataParseError) {
			return res.status(error.statusCode).json({ message: error.message });
		}
		console.error(error);
		return res.status(500).json({ message: "parse error" });
	}
}
