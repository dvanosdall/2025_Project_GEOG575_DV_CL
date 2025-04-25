import { state } from './globals.js'
import { callback, formatNumber } from "./data.js";

/**
     * Set up choropleth map
     *
     * Creates an SVG element for the map inside a container, sets up the
     * geographic projection using d3.geoAlbers with specified parameters, and loads the
     * required CSV and TopoJSON data files. Once all data is loaded, it calls the
     * `callback` function to further process the data and render the map.
     */
export function setMap() {
    const mapContainer = document.querySelector(".map-wrapper");
    const { width: svgWidth, height: svgHeight } = mapContainer.getBoundingClientRect();

    // create svg and set size
    state.map = d3.select(".map-wrapper")
        .append("svg")
        .attr("class", "map")
        .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%");

    // create a group that will contain all map content
    state.mapGroup = state.map.append("g").attr("class", "map-group");

    // set map projection (adjust scale for zoomed-in view)
    state.projection = d3.geoAlbers()
        .rotate([90, 0, 0]) // adjust rotation as needed
        .center([0, 44.6])  // set center of the map
        .parallels([42, 195])
        .scale(8000) // set a higher scale value for a more zoomed-in view
        .translate([svgWidth / 2, svgHeight / 2]);

    // set path generator
    state.path = d3.geoPath().projection(state.projection);

    // load data files
    const promises = [
        d3.csv("data/filtered_wi_real_estate.csv"),
        d3.json("data/gz_2010_us_outline.topojson"),
        d3.json("data/gz_2010_us_states.topojson"),
        d3.json("data/gz_2010_wi_counties.topojson")
    ];
    Promise.all(promises).then(callback);

    // create tooltip
    state.tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("padding", "6px")
        .style("background", "white")
        .style("border", "1px solid #999")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0);
}

/**
     * Draw counties and apply choropleth coloring
     *
     * Adds county paths using geojson data, applies fill color
     * based on health data and color scale, and sets a glow filter
     * for highlight effects
     *
     * @param {*} countiesFeatures - geojson features for counties
     * @param {*} map - svg map container
     * @param {*} path - d3 geoPath projection
     * @param {*} breaksArray - classification breakpoints for coloring
     */

export function setCounties(countiesFeatures, map, path, breaksArray) {
    const mapGroup = state.mapGroup;

    if (d3.select(".map defs #glow").empty()) {
        const defs = d3.select(".map").append("defs");
        const filter = defs.append("filter")
            .attr("id", "glow")
            .attr("x", "-50%")
            .attr("y", "-50%")
            .attr("width", "200%")
            .attr("height", "200%");
        filter.append("feGaussianBlur")
            .attr("in", "SourceGraphic")
            .attr("stdDeviation", 4)
            .attr("result", "blur");
        filter.append("feMerge")
            .selectAll("feMergeNode")
            .data(["blur", "SourceGraphic"])
            .enter()
            .append("feMergeNode")
            .attr("in", d => d);
    }

    // Create a new group for the counties (this will be a new layer)
    const countyGroup = mapGroup.append("g").attr("class", "county-group");

    // Add counties to the map
    countyGroup.selectAll(".county")
        .data(countiesFeatures)
        .enter()
        .append("path")
        .attr("class", "county")
        .attr("d", path)
        .style("fill", d => {
            console.log(d);  // Log to check if counties are being drawn
            const countyName = d.properties.NAME.toLowerCase().trim();
            const record = state.priceByCounty[countyName];
            const val = record?.[state.expressed];
            return record && !isNaN(val) ? state.colorScale(val) : "#ccc";
        })
        .style("stroke", "#333")
        .style("stroke-width", 0.5)
        .style("pointer-events", "all")
        .style("z-index", 100)
        .attr("data-break", d => {
            const countyName = d.properties.NAME.toLowerCase().trim();
            const record = state.priceByCounty[countyName];
            if (record) {
                const value = +record[state.expressed];
                if (!isNaN(value)) {
                    for (let i = 0; i < breaksArray.length; i++) {
                        if (value <= breaksArray[i]) return breaksArray[i];
                    }
                    return "overflow";
                }
            }
            return "none";
        })
        .on("click", function (event, d) {
            console.log('County clicked:', d.properties.NAME);
            const countyName = d.properties.NAME.toLowerCase().trim();
            const record = state.priceByCounty[countyName];
                if (record) {
                    // Get the selected date from the dropdown
                    const selectedDate = state.expressed || "None";

                    // Populate the table with county data
                    const tableBody = d3.select("#county-info-table tbody");
                    tableBody.html(""); // Clear previous data

                    tableBody.append("tr").html(`
                        <td>${record.RegionID}</td>
                        <td>${record.SizeRank}</td>
                        <td>${record.RegionName}</td>
                        <td>${record.RegionType}</td>
                        <td>${record.StateName}</td>
                        <td>${record.State}</td>
                        <td>${record.StateCodeFIPS}</td>
                        <td>${record.MunicipalCodeFIPS}</td>
                        <td>${selectedDate}</td>
                    `);

                    // Show the modal
                    d3.select("#county-modal").style("display", "block");
                } else {
                    // Handle case where no data is available
                    d3.select("#county-info-table tbody").html("<tr><td colspan='9'>No data available for this county.</td></tr>");
                    d3.select("#county-modal").style("display", "block");
                }
            });

    // Close the modal when the user clicks on the close button
    d3.select(".close-btn").on("click", function () {
        d3.select("#county-modal").style("display", "none");
    });

    // Close the modal when the user clicks anywhere outside the modal
    window.onclick = function (event) {
        if (event.target === document.getElementById("county-modal")) {
            d3.select("#county-modal").style("display", "none");
        }
    };
}

/**
    * HighlightCounties
    *
    * Highlights counties within a given classification break and displays
    * dynamically placed labels using force simulation to avoid overlap.
    *
    * @param {*} breakValue - The data-break value to highlight.
    */


export function highlightCounties(breakValue) {
    // select all counties matching the break value
    const highlighted = d3.selectAll(".county")
        .filter(function () {
            return d3.select(this).attr("data-break") == breakValue;
        })
        .style("stroke", "#999")
        .style("stroke-width", 2)
        .raise()
        .classed("glowing", true);

    const labelData = [];

    // prepare label data for each highlighted county
    highlighted.each(function (d, i) {
        const countyName = d.properties.NAME;
        const rawValue = state.priceByCounty[countyName]?.[state.expressed];

        if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
            const value = isNaN(+rawValue) ? rawValue : formatNumber(rawValue);
            const centroid = state.path.centroid(d);
            const angle = (i - 1.5) * 12;
            let radius = 60;

            // clamp label within bounds
            const svgBox = state.map.node().viewBox.baseVal;
            const maxX = svgBox.width;
            const maxY = svgBox.height;
            const padding = 10;
            const maxRadius = 60;

            radius = Math.min(radius, maxRadius);

            let x, y;
            while (radius > 10) {
                x = centroid[0] + radius * Math.cos(angle * Math.PI / 180);
                y = centroid[1] + radius * Math.sin(angle * Math.PI / 180);
                if (
                    x >= padding &&
                    x <= maxX - padding &&
                    y >= padding &&
                    y <= maxY - padding
                ) break;
                radius -= 5;
            }

            x = Math.max(padding, Math.min(x, maxX - padding));
            y = Math.max(padding, Math.min(y, maxY - padding));

            labelData.push({ countyName, value, centroid, x, y, radius: 50 });
        }
    });

    // avoid label overlap using force simulation
    const simulation = d3.forceSimulation(labelData)
        .force("x", d3.forceX(d => d.centroid[0]).strength(0.02))
        .force("y", d3.forceY(d => d.centroid[1]).strength(0.02))
        .force("collide", d3.forceCollide(60))
        .stop();

    for (let i = 0; i < 250; ++i) simulation.tick();

    // draw label lines and labels
    labelData.forEach(d => {

        // shrink line length
        const dx = d.x - d.centroid[0];
        const dy = d.y - d.centroid[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        const shorten = 10;
        const shrinkX = d.x - (dx / dist) * shorten;
        const shrinkY = d.y - (dy / dist) * shorten;
        // line from county to label
        state.map.append("line")
            .attr("class", "county-callout")
            .attr("x1", d.centroid[0])
            .attr("y1", d.centroid[1])
            .attr("x2", shrinkX)
            .attr("y2", shrinkY)
            .attr("stroke", "#333")
            .attr("stroke-width", 1);

        // label group
        const group = state.map.append("g").attr("class", "county-callout-group");

        // county name
        const nameText = group.append("text")
            .attr("x", d.x)
            .attr("y", d.y - 4)
            .attr("text-anchor", "middle")
            .style("font-size", "11px")
            .style("font-family", "sans-serif")
            .text(d.countyName);

        // value label
        const valueText = group.append("text")
            .attr("x", d.x)
            .attr("y", d.y + 10)
            .attr("text-anchor", "middle")
            .style("font-size", "11px")
            .style("font-family", "sans-serif")
            .text(`${d.value}`);

        // adjust and draw bubble background behind text
        requestAnimationFrame(() => {
            const nameBBox = nameText.node().getBBox();
            const valueBBox = valueText.node().getBBox();
            const textWidth = Math.max(nameBBox.width, valueBBox.width);
            const bubblePadding = 6;
            const bubbleWidth = textWidth + bubblePadding * 2;
            const bubbleHeight = 28;

            const svgBox = state.map.node().viewBox.baseVal;
            const padding = 6;
            const maxX = svgBox.width;
            const maxY = svgBox.height;

            d.x = Math.max(bubbleWidth / 2 + padding, Math.min(d.x, maxX - bubbleWidth / 2 - padding));
            d.y = Math.max(bubbleHeight / 2 + padding, Math.min(d.y, maxY - bubbleHeight / 2 - padding));

            nameText.attr("x", d.x).attr("y", d.y - 4);
            valueText.attr("x", d.x).attr("y", d.y + 10);

            console.log("bubbleWidth:", bubbleWidth, "bubbleHeight:", bubbleHeight);

            group.insert("rect", "text")
                .attr("x", d.x - bubbleWidth / 2)
                .attr("y", d.y - 16)
                .attr("width", bubbleWidth)
                .attr("height", bubbleHeight)
                .attr("rx", 6)
                .attr("ry", 6)
                .style("fill", "rgba(255, 255, 255, 0.9)")
                .style("stroke", "#999")
                .style("stroke-width", 2);
        });
    });
}

/**
 * UnhighlightCounties
 *
 * Resets all county styles to default and removes any callout labels and lines.
 */

export function unhighlightCounties() {
    // reset stroke styles and remove highlight class
    d3.selectAll(".county")
        .style("stroke", "#333")
        .style("stroke-width", 0.5)
        .classed("glowing", false);
    // remove all leader lines
    d3.selectAll(".county-callout").remove();
    // remove all label groups
    d3.selectAll(".county-callout-group").remove();
}
