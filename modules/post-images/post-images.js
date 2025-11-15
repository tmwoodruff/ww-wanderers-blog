import { escapeAttribute } from "entities";

function imageShortcode(src, size = "", psize = "", psrc = "", alt="") {
	src = src.replace(/^https:\/\/[^/]+\//, "");
	src = src.replace(/^images\//, "");
	src = `https://assets.ww-wanderers.cc/images/${src}`;

	if (size === "") {
		const m = /(.*\/)?.*\.(\d+x\d+)\.[^.]+$/.exec(src);
		if (m) {
			size = m[1];
		}
	}

	let sizeAttrs = "";
	if (size !== "") {
		const [width, height] = size.split('x');
		sizeAttrs = `data-pswp-width="${width}" data-pswp-height="${height}"`;
		if (psize == "") {
			const pWidth = Math.round(width / (height / 240));
			const pHeight = 240
			psize = `${pWidth}x${pHeight}`;
		}
	}
	let psizeAttrs = "";
	if (psize !== "") {
		const [width, height] = psize.split('x');
		psizeAttrs = `width="${width}" height="${height}"`
	}
	if (psrc == "") {
		psrc = src.replace(/(?:\.\d+x\d+\.)?([^.]+)$/, "-240.$1");
	}
	alt = escapeAttribute(alt);
	return `
		<a class="post-image" href="${src}" ${sizeAttrs}>
			<img eleventy:ignore class="post-img" ${psizeAttrs} src="${psrc}"
				loading="lazy" decoding="async" alt="${alt}"/>
		</a>
	`.replace(/(\\r\n|\n|\r)/gm, "");
}

function addPhotoswipe(content) {
	const url = this.url || "";
	const outputPath = this.page.outputPath || "";
	if (!url.startsWith("/blog/") || !outputPath.endsWith(".html")) {
		return content;
	}

	const photoswipeContent = `
		<link rel="stylesheet" href="/css/photoswipe/photoswipe.css">
		<script type="module">
			import PhotoSwipeLightbox from '/js/photoswipe/photoswipe-lightbox.esm.min.js';
			import PhotoSwipe from '/js/photoswipe/photoswipe.esm.min.js';
			const lightbox = new PhotoSwipeLightbox({
				gallery: '.post-content',
				children: 'a.post-image',
				pswpModule: PhotoSwipe,
				preload: [1, 1]
			});
			lightbox.init();
		</script>
	`.replace(/(\r\n|\n|\r)/gm, "");

	return `${content}\n${photoswipeContent}`;
}

function layoutImagesPlugin(context) {
	const url = context.url || "";
	if (!url.startsWith("/blog/")) return (tree) => tree;
	if (!url.includes("2024-08-08-north-cascades")) return (tree) => tree;

	return (tree) => {
		tree.match({"tag": "div", "attrs": {"class": "post-content"}}, (divNode) => {
			let imageGroup = [];
			for (const node of divNode.content) {
				if (typeof(node) == "object" && node.tag == "p" && (node.content ?? []).length == 1
						&& node.content[0].tag == "a" && (node.content[0].attrs ?? {}).class == "post-image") {
					imageGroup.push(node);
				} else {
					imageGroup = [];
				}
			}
			return divNode;
		});
	};
}

export default (eleventyConfig) => {
	eleventyConfig.addPassthroughCopy({
		"./node_modules/photoswipe/dist/photoswipe-lightbox.esm.min.js":
			"/js/photoswipe/photoswipe-lightbox.esm.min.js",
		"./node_modules/photoswipe/dist/photoswipe.esm.min.js":
			"/js/photoswipe/photoswipe.esm.min.js",
		"./node_modules/photoswipe/dist/photoswipe.css":
		  "/css/photoswipe/photoswipe.css",
	});
	eleventyConfig.addShortcode("image", imageShortcode);
	eleventyConfig.addTransform("photoswipejs", addPhotoswipe);
	eleventyConfig.htmlTransformer.addPosthtmlPlugin("html", layoutImagesPlugin, {"name": "layout-images"});
};
