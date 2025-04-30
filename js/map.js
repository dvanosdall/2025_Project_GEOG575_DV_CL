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
  let savedRows = [];

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

  // Create a new group for the counties
  const countyGroup = mapGroup.append("g").attr("class", "county-group");

  // Initialize the download button to be disabled
  const downloadButton = document.getElementById("download-csv-btn");
  downloadButton.disabled = true;

  // Add counties to the map
  countyGroup.selectAll(".county")
  .data(countiesFeatures)
  .enter()
  .append("path")
  .attr("class", "county")
  .attr("d", path)
  .style("fill", d => {
    const countyName = d.properties.NAME.toLowerCase().replace(" county", "").trim();
    const record = state.priceByCounty[countyName];
    const val = record?.[state.expressed];
    return record && !isNaN(val) ? state.colorScale(val) : "#ccc";
  })
  .style("stroke", "#333")
  .style("stroke-width", 0.5)
  .style("pointer-events", "all")
  .style("z-index", 100)
  .attr("data-break", d => {
    const countyName = d.properties.NAME.toLowerCase().replace(" county", "").trim();
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
  .on("mouseover", function (event, d) {
    d3.selectAll(".tooltip").remove(); // Remove any existing tooltips
    const countyName = d.properties.NAME.toLowerCase().replace(" county", "").trim();
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY + 10) + "px")
      .html(countyName);
  })
  .on("mousemove", function (event) {
    d3.select(".tooltip")
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY + 10) + "px");
  })
  .on("mouseout", function (event, d) {
    if (!d3.select(this).node().contains(event.relatedTarget)) {
      d3.select(".tooltip").remove();
    }
  })
  .on("click", function (event, d) {
    const countyName = d.properties.NAME.toLowerCase().replace(" county", "").trim();
    const record = state.priceByCounty[countyName];

    if (record) {
      const selectedDate = state.expressed || "None";
      const value = record[selectedDate];

      const format = d3.timeFormat("%B %Y");
      const formattedDate = format(new Date(selectedDate));

      // Append new entry to county list
      const countyList = d3.select("#county-list");
      const countyEntry = countyList.append("div")
        .attr("class", "county-entry");
      countyEntry.html(`
        <div class="county-name">
          <strong>${record.RegionName}</strong>
          <button class="remove-button">&times;</button>
        </div>
        <div>
          Month / Year: ${formattedDate}<br>
          Avg. Value: $${formatNumber(value)}<br>
          Region Type: ${record.RegionType}<br>
          State: ${record.State}
        </div>
      `);
      const hr = countyList.append("hr");

      // Add event listener to remove button
      countyEntry.select(".remove-button")
        .on("click", function () {
          // Remove entry from savedRows array
          savedRows = savedRows.filter(r => r.County !== record.RegionName);

          // Remove entry from county list
          countyEntry.remove();
          hr.remove();

          // Update download button
          const downloadButton = document.getElementById("download-csv-btn");
          if (savedRows.length === 0) {
            downloadButton.disabled = true;
          } else {
            downloadButton.disabled = false;
            downloadButton.onclick = function () {
              const csvContent = "data:text/csv;charset=utf-8,"
                + ["County,Date,Value,RegionType,State"]
                  .concat(savedRows.map(r => `${r.County},${r.Date},${r.Value},${r.RegionType},${r.State}`))
                  .join(",\n");

              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", "saved_counties.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            };
          }
        });

      // Auto open sidebar if closed
      sidebar.classList.add("open");

      // Push to saved array
      savedRows.push({
        County: record.RegionName,
        Date: selectedDate,
        Value: value,
        RegionType: record.RegionType,
        State: record.State,
      });

      // Update download button
      const downloadButton = document.getElementById("download-csv-btn");
      if (savedRows.length > 0) {
        downloadButton.disabled = false;
        downloadButton.onclick = function () {
          const csvContent = "data:text/csv;charset=utf-8,"
            + ["County,Date,Value,RegionType,State"]
              .concat(savedRows.map(r => `${r.County},${r.Date},${r.Value},${r.RegionType},${r.State}`))
              .join(",\n");

          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", "saved_counties.csv");
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };
      } else {
        downloadButton.disabled = true;
      }
    }
  });



  /*  setCounties() gets called a lot and this would add a bunch of listeners

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

  */
}

/**
    * HighlightCounties
    *
    * Highlights counties within a given classification break and displays
    * dynamically placed labels using force simulation to avoid overlap.
    *
    * @param {*} breakValue - The data-break value to highlight.
    */


export function highlightCounties(lowerBound, upperBound) {
  // Clear old highlights
  d3.selectAll(".county")
    .classed("highlighted", false)
    .classed("glowing", false)
    .style("stroke", "#333")
    .style("stroke-width", 0.5)
    .lower();

  d3.selectAll(".county-label").remove(); // Remove old labels

  // Highlight matching counties
  d3.selectAll(".county")
    .classed("highlighted", function (d) {
      const countyName = d.properties.NAME.toLowerCase().replace(" county", "").trim();
      const countyData = state.priceByCounty[countyName];
      if (!countyData) return false;

      const value = +countyData[state.expressed];
      return value >= lowerBound && value <= upperBound;
    })
    .classed("glowing", function (d) {
      const countyName = d.properties.NAME.toLowerCase().replace(" county", "").trim();
      const countyData = state.priceByCounty[countyName];
      if (!countyData) return false;

      const value = +countyData[state.expressed];
      return value >= lowerBound && value <= upperBound;
    })
    .style("stroke", function (d) {
      const countyName = d.properties.NAME.toLowerCase().replace(" county", "").trim();
      const countyData = state.priceByCounty[countyName];
      if (!countyData) return "#333";

      const value = +countyData[state.expressed];
      return value >= lowerBound && value <= upperBound ? "yellow" : "#333";
    })
    .style("stroke-width", function (d) {
      const countyName = d.properties.NAME.toLowerCase().replace(" county", "").trim();
      const countyData = state.priceByCounty[countyName];
      if (!countyData) return 0.5;

      const value = +countyData[state.expressed];
      return value >= lowerBound && value <= upperBound ? 2 : 0.5;
    })
    .each(function (d) {
      const isHighlighted = d3.select(this).classed("highlighted");
      if (isHighlighted) {
        const centroid = state.path.centroid(d);
        // Add a label to highlighted counties
        state.map.append("text")
          .attr("class", "county-label")
          .attr("x", centroid[0])
          .attr("y", centroid[1])
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("font-family", "sans-serif")
          .attr("fill", "black")
          .text(d.properties.NAME);
      }
    })
    .raise(); // bring glowing counties to front
}


/**
 * UnhighlightCounties
 *
 * Resets all county styles to default and removes any callout labels and lines.
 */

export function unhighlightCounties() {
  d3.selectAll(".county")
    .classed("highlighted", false)
    .classed("glowing", false)
    .style("stroke", "#333")
    .style("stroke-width", 0.5)
    .lower();

  d3.selectAll(".county-label").remove(); //  Remove all labels
}

