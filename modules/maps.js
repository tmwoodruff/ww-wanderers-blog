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
    eleventyConfig.addFilter("visitedUSStates", getVisitedUSStates);
};


function getVisitedCountries(allPosts) {
    return getVisited(getAllTags.apply(this, [allPosts]), this.ctx.mapData.countries);
}

function getVisitedUSStates(allPosts) {
    return getVisited(getAllTags.apply(this, [allPosts]), this.ctx.mapData.usStates);
}

function getVisited(allTags, entities) {
    const visited = [];
    for (const v of entities) {
        if (allTags.has(v.tag)) {
            v.linkable = true;
        }
        if (v.visited) {
            visited.push(v);
            v.detailAnchor = `${v.id}-detail`
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

    const mapEntities = filename === "united-states"
        ? this.ctx.mapData.usStatesById
        : this.ctx.mapData.countriesById;

    data = (new MapUpdater(mapEntities, allTags)).processMap(data);

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
                // This logic is ugly, but the work map has country codes in `id`, and the US map has
                // state abbreviations in `class`, and this allow us to avoid changing the map data.
                if (child.attrs?.id || (child.attrs?.class && child.attrs.class.match(/\b[a-z]{2}\b/))) {
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
        // This logic is ugly, but the work map has country codes in `id`, and the US map has
        // state abbreviations in `class`, and this allow us to avoid changing the map data.
        let id = node.attrs?.id;
        if (!id) {
            const classes = (node.attrs.class ?? "").split(/\s+/);
            id = classes.filter(c => c in this.allEntities)?.[0];
        }
        const entityId = (id ?? "");

        const entity = this.allEntities[entityId] ?? {};
        if (entity.name) {
            node.content = node.content ?? [];
            node.content.push({tag: "title", content: entity.name});
        }
        if (entity.visited || this.allTags.has(entity.tag)) {
            let classes = " visited";
            if (this.allTags.has(entity.tag)) classes += " has-posts"
            node.attrs.class = (node.attrs?.class ?? "") + classes;
            const href = `#${entity.id}-detail`;
            return {
                "tag": "a",
                "attrs": {"href": href},
                "content": [node]
            }
        }
        return node;
    }
}
