import { state } from './globals.js'
import { setCounties, setMap } from './map.js';
import { setChart } from './chart.js';

const pastelGreens = [
  "#e6f4ea",
  "#ccead5",
  "#b3e0c1",
  "#99d6ac",
  "#80cc98",
  "#66c283",
  "#4db86f",
  "#33ae5a",
  "#1aa446"
];

/**
  * Processes the loaded CSV and TopoJSON data to render the map and chart.
  *
  * Callback function to convert TopoJSON data into GeoJSON features,
  * generate a graticule, and make a color scale using Jenks or Quantile
  * classification on the "Years of Potential Life Lost Rate" field from the CSV.
  * It then draws the map elements (graticule, state boundaries, counties, and outline)
  * and finally calls the setChart function to render the coordinated bar chart.
  *
  * @param {Array} data - An array containing the following:
  *   [0]: CSV data,
  *   [1]: TopoJSON for the outline,
  *   [2]: TopoJSON for states,
  *   [3]: TopoJSON for counties.
  */
export function callback(data) {
  let breaksArray;
  // unpack csv and topojson
  const fullCsvData = data[0];
  // filter for wisconsin counties
  const csvData = fullCsvData.filter(d => d.StateName === "WI"),
    outlineTopo = data[1],
    statesTopo = data[2],
    countiesTopo = data[3],
    statesGeo = topojson.feature(statesTopo, statesTopo.objects.gz_2010_us_040_00_500k),
    countiesGeo = topojson.feature(countiesTopo, countiesTopo.objects.gz_2010_us_out_counties)

  // identify year columns
  state.attrArray = fullCsvData.columns.filter(col =>
    /\d{4}-\d{2}-\d{2}/.test(col) && col >= "2016-02-29"
  );


  if (!state.expressed) {
    state.expressed = state.attrArray[state.attrArray.length - 1];
  }


  // parse values and build lookup
  state.priceByCounty = {};
  csvData.forEach(d => {
    const cleanedName = d.RegionName.toLowerCase().replace(" county", "").trim();
    const raw = d[state.expressed];


    d.rawValue = raw;
    d[state.expressed] = raw === undefined || raw === null || raw === "" ? NaN : +raw.toString().replace(/,/g, '');
    state.priceByCounty[cleanedName] = d;
  });

  // filter and sort numeric values
  const expressedValues = csvData
    .map(d => d[state.expressed])
    .filter(v => !isNaN(v) && isFinite(v))
    .sort((a, b) => a - b);

  if (expressedValues.length < 2) {
    alert(`Not enough valid data for "${state.expressed}"`);
    throw new Error("Bad data column selected");
  }

  // create color scale and breaks
  const unique = [...new Set(expressedValues)];

  if (unique.length < 5) {
    console.warn("Too few unique values — using quantile");
    colorScale = d3.scaleQuantile()
      .domain(expressedValues)
      .range(pastelGreens.slice(0, 5));

    breaksArray = colorScale.quantiles();
  } else {
    const numBreaks = Math.min(9, unique.length - 1);
    const rawBreaks = ss.jenks(expressedValues, numBreaks);
    breaksArray = [...new Set(rawBreaks.slice(1))];
    const numColors = breaksArray.length + 1;
    const colorRange = pastelGreens.slice(0, numColors);

    state.colorScale = d3.scaleThreshold()
      .domain(breaksArray)
      .range(colorRange);
  }


  // draw states
  state.map.append("path")
    .datum(statesGeo)
    .attr("class", "states")
    .attr("d", state.path)
    .style("stroke", "#333")
    .style("fill", "rgba(128,128,128,.2)")
    .style("pointer-events", "none")//
    .style("stroke-width", 1);

  // draw counties
  setCounties(countiesGeo.features, state.map, state.path, breaksArray);

  // draw chart + dropdown
  setChart(csvData, state.colorScale, breaksArray, expressedValues);
  createDropdown();
  setSlider();
}

/**
 * Helper function to format a number with commas and up to 2 decimal places. Used for pop up styling
 *
 * @param {*} value
 * @returns
 */
export function formatNumber(value) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2
  });
}

/**
 * Make a dropdown menu for selecting real estate prices
 *
 * Populates options from attrArray, attaches event listener
 * to update the map and chart when selection changes
 */

export function createDropdown() {
  const wrapper = d3.select(".dropdown-wrapper");

  // clear any existing dropdown
  wrapper.selectAll("*").remove();

  // add <select> element
  const dropdown = wrapper
    .append("select")
    .attr("class", "dropdown");

  // add default text option
  dropdown.append("option")
    .attr("class", "titleOption")
    .attr("disabled", true)
    .attr("selected", true)
    .text("Real Estate Prices By Month 2017-2024");

  // Format the dates as 'Month/Year' and add options for each attribute
  dropdown.selectAll("option.attrOption")
    .data(state.attrArray)
    .enter()
    .append("option")
    .attr("class", "attrOption")
    .attr("value", d => d)
    .text(d => {
      // Parse the date and format it to 'Month/Year'
      const date = new Date(d);  // Convert the date string to a Date object
      const month = date.toLocaleString('default', { month: 'long' });  // Get full month name
      const year = date.getFullYear();  // Get the year
      return `${month} ${year}`;  // Return in 'Month Year' format
    });

  // update visuals when selection changes
  dropdown.on("change", function () {
    state.expressed = this.value;

    // Update the slider to match the dropdown
    const slider = document.getElementById("timeSlider");
    slider.value = state.attrArray.indexOf(this.value);

    // Show the chart when a selection is made
    d3.select(".chart-wrapper").style("display", "block");
    updateVis();
  });
}

/**
 * update the map and chart when a new attribute is selected
 *
 * clears old svg elements and re-renders everything fresh
 * function updateVis() {
    // clear existing chart svg
    d3.select(".chart-wrapper").selectAll("svg").remove();
    // clear existing map svg
    d3.select(".map-wrapper").selectAll("svg").remove();
    // rebuild map (and chart via callback)
    setMap();
}
 */

export function updateVis() {
  // update color scale and breaks
  const expressedValues = Object.values(state.priceByCounty)
    .map(d => +d[state.expressed])
    .filter(v => !isNaN(v) && isFinite(v))
    .sort((a, b) => a - b);

  const unique = [...new Set(expressedValues)];

  let colorScale, breaksArray;

  if (unique.length < 5) {
    colorScale = d3.scaleQuantile()
    .domain(expressedValues)
    .range(pastelGreens.slice(0, 5));

    breaksArray = colorScale.quantiles();
  } else {
    const numBreaks = Math.min(9, unique.length - 1);
    const rawBreaks = ss.jenks(expressedValues, numBreaks);
    breaksArray = [...new Set(rawBreaks.slice(1))];
    const numColors = breaksArray.length + 1;
    const colorRange = pastelGreens.slice(0, numColors);

    colorScale = d3.scaleThreshold()
      .domain(breaksArray)
      .range(colorRange);

  }

  state.colorScale = colorScale;

  // transition county fill colors
  d3.selectAll(".county")
    .transition()
    .duration(500)
    .style("fill", function (d) {
      const countyName = d.properties.NAME.toLowerCase().replace(" county", "").trim();
      const countyData = state.priceByCounty[countyName];
      const value = countyData ? +countyData[state.expressed] : NaN;
      return isNaN(value) ? "#ccc" : state.colorScale(value);
    });

  // redraw chart
  d3.select(".chart-wrapper").selectAll("svg").remove();
  const cleanData = Object.values(state.priceByCounty)
    .filter(d => {
      const value = +d[state.expressed];
      return !isNaN(value) && isFinite(value);
    });

  setChart(cleanData, state.colorScale, breaksArray, expressedValues);

}


export function setSlider() {
  const chartWrapper = document.querySelector(".chart-wrapper");

  const sliderContainer = document.createElement("div");
  sliderContainer.classList.add("slider-container");

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = state.attrArray.length - 1;
  slider.step = 1;
  slider.value = state.attrArray.indexOf(state.expressed);
  slider.id = "timeSlider";

  const dropdown = document.querySelector(".dropdown");

  const playButton = document.createElement("button");
  playButton.textContent = "▶️ Play";
  playButton.id = "playButton";
  playButton.style.marginLeft = "10px";

  sliderContainer.appendChild(playButton);
  sliderContainer.appendChild(slider);
  sliderContainer.appendChild(dropdown);

  // puts slider container above the chart
  chartWrapper.prepend(sliderContainer);

  // button functionality
  let playing = false;
  let playInterval;

  playButton.addEventListener("click", function () {
    if (playing) {
      clearInterval(playInterval);
      playButton.textContent = "▶️ Show Time Lapse";
    } else {
      playInterval = setInterval(() => {
        let newValue = +slider.value + 1;
        if (newValue > state.attrArray.length - 1) {
          newValue = 0; // loop back to start? Might be better to just stop here
        }
        slider.value = newValue;
        const selectedAttr = state.attrArray[newValue];
        state.expressed = selectedAttr;
        dropdown.value = selectedAttr;

        updateVis();
      }, 250); // slide speed
      playButton.textContent = "⏸️ Pause";
    }
    playing = !playing;
  });

  // Set up slider input event
  slider.addEventListener("input", function () {
    const selectedAttr = state.attrArray[this.value];
    state.expressed = selectedAttr;
    dropdown.value = selectedAttr;

    updateVis();
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('default', { month: 'short', year: 'numeric' });
}
