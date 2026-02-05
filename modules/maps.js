import path from "node:path";
import fs from "node:fs";
import posthtml from "posthtml";
import { notEqual } from "node:assert";


/** @param {import("@11ty/eleventy/UserConfig")} eleventyConfig */
export default (eleventyConfig) => {
	eleventyConfig.addPassthroughCopy({
		"./node_modules/svg-pan-zoom/dist/svg-pan-zoom.min.js":
			"/js/svg-pan-zoom/svg-pan-zoom.min.js",
	});

    eleventyConfig.addShortcode("map", updateSvgMap);

    eleventyConfig.addFilter("visitedCountries", getVisitedCountries);
};


function getVisitedCountries(allPosts) {
    const allTags = getAllTags.apply(this, [allPosts]);
    const visited = [];
    for (const country of this.ctx.mapData.countries) {
        if (allTags.has(country.tag)) {
            country.linkable = true;
        }
        if (country.visited) {
            visited.push(country);
        }
    }
    visited.sort((a, b) => Intl.Collator().compare(a.name, b.name));
    return visited;
}

function updateSvgMap(filename) {
    const allTags = getAllTags.apply(this, [this.ctx.collections.posts]);

    // Construct the full path to the file in your _includes folder
    const relativePath = `_includes/maps/${filename}.svg`;
    const fullPath = path.join(process.cwd(), relativePath);

    if (!fs.existsSync(fullPath)) {
    console.warn(`SVG Shortcode Error: File not found at ${fullPath}`);
    return "";
    }

    // Read the file content
    let data = fs.readFileSync(fullPath, 'utf-8');

    data = data.replace(/<\?xml.*?\?>/gi, '');
    data = data.replace(/<!doctype.*?>/gi, '');
    data = data.replace(/<title>[^<]+<\/title>/gi, '');

    data = data.replace(/<svg([ >])/gi, '<svg id="map"$1');

    data = (new MapUpdater(this.ctx.mapData.byId, allTags)).processMap(data);

    return data;
}

function getAllTags(allPosts) {
    const allTags = new Set();
    const slugify = this.env.filters.slugify;
    allPosts.forEach(item => {
        if (Array.isArray(item.data.tags)) {
        item.data.tags.forEach(tag => allTags.add(slugify.apply(this, [tag])));
        }
    });
    return allTags;
}


class MapUpdater {
    constructor(allEntities, allTags) {
        this.allEntities = allEntities;
        this.allTags = allTags;
    }

    processMap(content) {
        const plugin = (tree) => {
            tree.match({"tag": "svg"}, (svgNode) => {
                svgNode = this.processMapEntities(svgNode);
                svgNode.content.push({
                    tag: "script",
                    content: 'svgPanZoom("#map", {zoomEnabled: true, controlIconsEnabled: true, mouseWheelZoomEnabled: false})'
                });
                return svgNode;
            });
            return tree;
        };

        return posthtml([plugin]).process(content, {sync: true}).html;
    }

    processMapEntities(node) {
        const newContents = [];
        for (const child of node.content) {
            if (typeof child === "object") {
                if (child.attrs?.id) {
                    newContents.push(this.processMapEntity(child));
                } else if (child.content) {
                    newContents.push(this.processMapEntities(child));
                } else {
                    newContents.push(child);
                }
            } else {
                newContents.push(child);
            }
        }
        node.content = newContents;
        return node;
    }

    processMapEntity(node) {
        const id = node.attrs?.id ?? "";
        const entity = this.allEntities[id] ?? {};
        if (entity.name) {
            node.title = entity.name;
            node.content = node.content ?? [];
            node.content.push({tag: "title", content: entity.name});
        }
        if (entity.visited) {
            let classes = " visited";
            if (this.allTags.has(entity.tag)) classes += " has-posts"
            node.attrs.class = (node.attrs?.class ?? "") + classes;
            const href = this.allTags.has(entity.tag) ? `/tags/${entity.tag}` : `#${entity.id}-link`;
            return {
                "tag": "a",
                "attrs": {"href": href},
                "content": [node]
            }
        }
        return node;
    }
}
