import slugify from 'slugify';
import { DateTime } from 'luxon';

const BLOG_PATH_PATTERN = /content\/blog\/([^/]+)\/[^/]+.md$/;

const allTrips = [];
const tripsAndStandalonePosts = [];

export function initializeTrips(posts) {
    if (allTrips.length > 0) {
        // already initialized
        return;
    }
    for (const post of posts) {
        _processPost(post.data);
    }
    for (const item of tripsAndStandalonePosts) {
        item.startDate = item.startDate ?? item.minDate;
        item.endDate = item.endDate ?? item.maxDate;
    }
    allTrips.sort(_compareTripsOrPosts);
    tripsAndStandalonePosts.sort(_compareTripsOrPosts);
}

function _processPost(data) {
    let postTrip = data.trip;

    if (!postTrip) {
        postTrip = {
            title: data.title,
        };
    }

    if (!postTrip.id) {
        const pathMatch = BLOG_PATH_PATTERN.exec(data.page.inputPath);
        if (!pathMatch) {
            // Not a trip. Save as a post.
            _addPost(data);
            return;
        }
        postTrip.id = pathMatch[1];
    }

    data.trip = _addTrip(postTrip, data);
}

function _addTrip(postTrip, data) {
    const tripIdx = _findItemIndex(allTrips, postTrip.id);
    let trip;
    if (tripIdx >= 0) {
        trip = allTrips[tripIdx];
        if (!data.ignoreDate) {
            trip.minDate = data.date < trip.minDate ? data.date : trip.minDate;
            trip.maxDate = data.date > trip.maxDate ? data.date : trip.maxDate;
        }
        // More than one post, so use trip URL
        trip.url = `/trips/${slugify(postTrip.id)}/`,
            trip.postCount++;
    } else {
        trip = {
            ...postTrip,
            postCount: 1,
            url: `/trips/${slugify(postTrip.id)}/`,
            img: data.img,
            minDate: data.date,
            maxDate: data.date
        };
    }

    if (tripIdx < 0) {
        allTrips.push(trip);
        tripsAndStandalonePosts.push(trip);
    }

    return trip
}

function _addPost(data) {
    const post = {
        id: _getStandalonePostId(data.page),
        title: data.title,
        img: data.img,
        postCount: 1,
        url: _getPageUrl(data.page),
        img: data.img,
        minDate: data.date,
        maxDate: data.date
    };
    tripsAndStandalonePosts.push(post);
    return post
}

function _findItemIndex(arr, itemId) {
    if (!itemId) return -1;
    return arr.findIndex(t => t.id === itemId)
}

function _getStandalonePostId(page) {
    return page.filePathStem;
}

function _getPageUrl(page) {
    return page.inputPath.replace(/\.\/content(\/.*?)(?:\.[^.]*)?$/, "$1/");
}

function _compareTripsOrPosts(a, b) {
    if (a.startDate > b.startDate) return 1;
    if (a.startDate < b.startDate) return -1;
    return (a.title ?? "").localeCompare(b.title ?? "");
}

function getTripDates(trip) {
    const startDate = trip.startDate ?? trip.date;
    const endDate = trip.endDate ?? trip.date;
    if (!startDate) return "";

    const startYear = startDate.getUTCFullYear();
    const startMonth = startDate.getUTCMonth();
    const startDay = startDate.getUTCDate();
    const endYear = endDate.getUTCFullYear();
    const endMonth = endDate.getUTCMonth();
    const endDay = endDate.getUTCDate();

    if (startYear === endYear) {
        if (startMonth === endMonth) {
            if (startDay === endDay) {
                return DateTime.fromJSDate(startDate, { zone: "utc" }).toFormat('LLLL dd, yyyy');
            } else {
                return DateTime.fromJSDate(startDate, { zone: "utc" }).toFormat('LLLL yyyy');
            }
        } else {
            return DateTime.fromJSDate(startDate, { zone: "utc" }).toFormat('LLLL') + " - " +
                DateTime.fromJSDate(endDate, { zone: "utc" }).toFormat('LLLL yyyy');
        }
    } else {
        return DateTime.fromJSDate(startDate, { zone: "utc" }).toFormat('LLLL yyyy') + " - " +
            DateTime.fromJSDate(endDate, { zone: "utc" }).toFormat('LLLL yyyy');
    }
}

function getTripPosts(allPosts, trip) {
    return allPosts.filter(d => d.data.trip?.id === trip.id);
}

function getTrip(trip, offset) {
    if (trip === undefined || trip === null) {
        return;
    }
    if (allTrips.length == 0) {
        initializeTrips(this.ctx.collections.posts);
    }
    const tripIdx = _findItemIndex(allTrips, trip.id);
    const offsetIdx = tripIdx + offset;
    if (offsetIdx >= 0 && offsetIdx < allTrips.length) {
        return allTrips[offsetIdx];
    }
}

function getPostOrTrip(allPosts, ctx, offset) {
    if (ctx.trip && ctx.page.url !== ctx.trip.url) {
        // This is a post within a trip, so return a post from the same trip if it exists.
        const tripPosts = getTripPosts(allPosts, ctx.trip);
        const offsetTripPost = getPost(tripPosts, ctx.page, offset);
        if (offsetTripPost) {
            return {
                title: offsetTripPost.data.title,
                url:offsetTripPost.url
            };
        }
        // If we are at the first trip post, include the trip page.
        // Otherwise, return the next trip or page
        if (offset < 0) offset++;
        return getTripOrStandalonePost(ctx.trip.id, offset);
    } else {
        // This is a high-level trip page or a non-trip (standalone) post, return the next trip or standalone post
        return getTripOrStandalonePost(ctx.trip?.id ?? _getStandalonePostId(ctx.page), offset);
    }
}

function getPost(posts, currentPage, offset) {
    const postIdx = posts.findIndex(p => p.outputPath === currentPage.outputPath || p.url === currentPage.url);
    if (postIdx >= 0) {
        const offsetIdx = postIdx + offset;
        if (offsetIdx >= 0 && offsetIdx < posts.length) {
            return posts[offsetIdx];
        }
    }
}

function getTripOrStandalonePost(currentId, offset) {
    if (tripsAndStandalonePosts.length == 0) {
        initializeTrips(this.ctx.collections.posts);
    }
    const itemIdx = _findItemIndex(tripsAndStandalonePosts, currentId);
    if (itemIdx >= 0) {
        const offsetIdx = itemIdx + offset;
        if (offsetIdx >= 0 && offsetIdx < tripsAndStandalonePosts.length) {
            return tripsAndStandalonePosts[offsetIdx];
        }
    }
}

/** @param {import("@11ty/eleventy/UserConfig")} eleventyConfig */
export default (eleventyConfig) => {
    eleventyConfig.addFilter("trips", function (allPosts) {
        initializeTrips(allPosts);
        return allTrips;
    });

    eleventyConfig.addFilter("tripsAndStandalonePosts", function (allPosts) {
        initializeTrips(allPosts);
        return tripsAndStandalonePosts;
    });

    eleventyConfig.addFilter("tripDates", getTripDates);

    eleventyConfig.addFilter("tripPosts", function (trip) {
        if (!trip) return [];
        return getTripPosts(this.ctx.collections.posts, trip);
    });

    eleventyConfig.addFilter("previousTrip", function (trip) { return getTrip(trip, -1); });
    eleventyConfig.addFilter("nextTrip", function (trip) { return getTrip(trip, 1); });
    eleventyConfig.addFilter("previousPostOrTrip", function (allPosts) { return getPostOrTrip(allPosts, this.ctx, -1); });
    eleventyConfig.addFilter("nextPostOrTrip", function (allPosts) { return getPostOrTrip(allPosts, this.ctx, 1); });
};
