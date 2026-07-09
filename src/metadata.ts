import domino from "domino";
import iconv from "iconv-lite";
// @ts-expect-error
import { getMetadata } from "page-metadata-parser";
import { detectEncode } from "./encoding";

export class MetadataParseError extends Error {
	constructor(
		public statusCode: number,
		message: string,
	) {
		super(message);
		this.name = "MetadataParseError";
	}
}

export async function fetchPageMetadata(url: string): Promise<{
	metadata: IPageMetadata;
	responseUrl: string;
}> {
	const r = await fetch(encodeURI(url), {
		headers: { "User-Agent": "Twitterbot/1.0" },
	});

	if (r.status >= 400) {
		throw new MetadataParseError(
			r.status,
			`remote status code was ${r.status}`,
		);
	}

	const contentType = r.headers.get("content-type");
	if (!contentType?.startsWith("text/html")) {
		throw new MetadataParseError(400, "remote content was not html");
	}

	const arrayBuffer = await r.arrayBuffer();
	const buf = Buffer.from(arrayBuffer);
	let html: string;
	const encoding = detectEncode(buf);
	if (encoding) {
		html = iconv.decode(buf, encoding);
	} else {
		html = buf.toString("ascii");
	}

	const { document } = domino.createWindow(html);
	const responseUrl = r.url || url;
	const metadata = getMetadata(document, responseUrl);

	return { metadata, responseUrl };
}

export type IPageMetadata = {
	description?: string;
	icon?: string;
	image?: string;
	keywords?: string[];
	title?: string;
	language?: string;
	type?: string;
	url: string;
	provider: string;
};
