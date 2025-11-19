import slugify from 'slugify';
import { DateTime } from "luxon";

const BLOG_PATH_PATTERN = /content\/blog\/([^/]+)\/[^/]+.md$/;

/** @param {import("@11ty/eleventy/UserConfig")} eleventyConfig */
export default (eleventyConfig) => {
    const allTrips = [];
    eleventyConfig.addGlobalData("allTrips", allTrips);

	eleventyConfig.addPreprocessor("trips", "md", (data, content) => {
        const pathMatch = BLOG_PATH_PATTERN.exec(data.page.inputPath);
        if (!pathMatch) {
            return;
        }

        const tripId = pathMatch[1];

        data.trip = tripId;

        const tripIdx = allTrips.findIndex(t => t.id === tripId);
        let trip;
        if (tripIdx >= 0) {
            trip = allTrips[tripIdx];
            trip.minDate = data.date < trip.minDate ? data.date : trip.minDate;
            trip.maxDate = data.date > trip.maxDate ? data.date : trip.maxDate;
        } else {
            trip = {
                id: tripId,
                title: data.category || tripId,
                url: `/trips/${slugify(tripId)}/`,
                minDate: data.date,
                maxDate: data.date
            };
        }

        let newIdx = allTrips.findIndex(t => t.minDate >= trip.minDate);
        if (newIdx < 0) newIdx = allTrips.length;

        if (newIdx !== tripIdx) {
            if (tripIdx >= 0) allTrips.splice(tripIdx, 1);
            allTrips.splice(newIdx, 1, trip);
        }
	});

    eleventyConfig.addFilter("tripDates", function(trip) {
        const minYear = trip.minDate.getUTCFullYear();
        const maxYear = trip.maxDate.getUTCFullYear();
        const minMonth = trip.minDate.getUTCMonth();
        const maxMonth = trip.maxDate.getUTCMonth();

        if (minYear === maxYear) {
            if (minMonth == maxMonth) {
                return DateTime.fromJSDate(trip.minDate, { zone: "utc" }).toFormat('LLLL yyyy');
            } else {
                return DateTime.fromJSDate(trip.minDate, { zone: "utc" }).toFormat('LLLL') + " - " +
                    DateTime.fromJSDate(trip.maxDate, { zone: "utc" }).toFormat('LLLL yyyy');
            }
        } else {
            return DateTime.fromJSDate(trip.minDate, { zone: "utc" }).toFormat('LLLL yyyy') + " - " +
                DateTime.fromJSDate(trip.maxDate, { zone: "utc" }).toFormat('LLLL yyyy');
        }
    });

    eleventyConfig.addFilter("tripPosts", function(trip) {
        return this.ctx.collections.posts.filter(d => d.data.trip === trip.id);
    });

    eleventyConfig.addFilter("previousTrip", function(trip) {
        if (!allTrips || trip === undefined || trip === null) {
            return;
        }
        const tripIdx = allTrips.findIndex(t => t.id === trip.id);
        return tripIdx <= 0 ? null : allTrips[tripIdx - 1];
    });

    eleventyConfig.addFilter("nextTrip", function(trip) {
        if (!allTrips || trip === undefined || trip === null) {
            return;
        }
        const tripIdx = allTrips.findIndex(t => t.id === trip.id);
        return tripIdx < 0 || tripIdx >= (allTrips.length - 1) ? null : allTrips[tripIdx + 1];
    });
};
