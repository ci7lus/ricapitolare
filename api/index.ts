import type { VercelRequest, VercelResponse } from "@vercel/node";
import isUrl from "is-url";
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
	if (typeof req.query.url !== "string") {
		swagger.info.version = version;
		res.setHeader("cache-control", "s-maxage=3600, stale-while-revalidate");
		return res.status(200).json(swagger);
	}

	const url = req.query.url;
	if (typeof url !== "string") {
		return res.status(500).json({ message: "url parse error" });
	}
	if (!isUrl(url)) {
		return res.status(400).json({ message: "requested url is not valid" });
	}

	try {
		const { metadata } = await fetchPageMetadata(url);
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
