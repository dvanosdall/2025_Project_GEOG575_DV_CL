import { state } from './globals.js'
import { formatNumber } from './data.js';
import { highlightCounties, unhighlightCounties } from './map.js';

// Function to dynamically adjust font size based on screen width
function getFontSize() {
    const screenWidth = window.innerWidth;
    if (screenWidth <= 600) { // Small screens (phones)
        return "0.8rem"; // Smaller font size for small screens
    }
    return "1rem"; // Default font size for larger screens
}

/**
 * Create coordinated lollipop chart
 *
 * Builds an svg chart using viewBox + margins, draws lines and circles
 * for data breaks, adds y axis and dynamic title, and links to data source
 *
 * @param {*} csvData - parsed csv with numeric values
 * @param {*} colorScale - d3 color scale for styling breaks
 * @param {*} breaksArray - array of numeric break values
 * @param {*} expressedValues - cleaned list of values for the current variable
 */
export function setChart(csvData, colorScale, breaksArray, expressedValues) {
    // debugging statements
    // console.log('csvData:', csvData);
    // console.log('colorScale:', colorScale);
    // console.log('breaksArray:', breaksArray);
    // console.log('expressedValues:', expressedValues);

    // get wrapper size
    const chartContainer = document.querySelector(".chart-wrapper");
    const { width } = chartContainer.getBoundingClientRect();

    // set svg and chart dimensions
    const svgWidth = width;
    const svgHeight = 300;
    const margin = { top: 50, right: 20, bottom: 80, left: 50 };
    let chartInnerWidth = svgWidth - margin.left - margin.right;
    const chartInnerHeight = svgHeight - margin.top - margin.bottom;
    const translate = `translate(${margin.left},${margin.top})`;

    // create svg
    const svg = d3.select(".chart-wrapper")
        .append("svg")
        .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%");

    console.log("svgWidth:", svgWidth, "svgHeight:", svgHeight);

    // background rect
    svg.append("rect")
        .attr("class", "chartBackground")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("fill", "transparent");

    // inner group with margin offset
    const chart = svg.append("g")
        .attr("transform", translate);

    // y scale
    const minVal = d3.min(csvData, d => d[state.expressed]);
    const maxVal = d3.max(csvData, d => d[state.expressed]);
    const buffer = (maxVal - minVal) * 0.5;

    const yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([minVal - buffer, maxVal + buffer]);

    // sort data
    csvData.sort((a, b) => b[state.expressed] - a[state.expressed]);

    const xScale = d3.scalePoint()
        .domain(breaksArray)
        .range([0, chartInnerWidth])
        .padding(0.5);

    // // horizontal zero line
    // chart.append("line")
    //     .attr("class", "zero-line")
    //     .attr("x1", 0)
    //     .attr("x2", chartInnerWidth)
    //     .attr("y1", yScale(0))
    //     .attr("y2", yScale(0))
    //     .attr("stroke", "#999")
    //     .attr("stroke-dasharray", "4 2");

    // lollipop stems
    chart.selectAll(".break-line")
        .data(breaksArray)
        .enter()
        .append("line")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", chartInnerHeight)
        .attr("y2", d => yScale(d))
        .attr("stroke", "#999")
        .on("mouseover", function (event, d) {
            const index = breaksArray.indexOf(d);
            const lowerBound = index === 0 ? d3.min(expressedValues) : breaksArray[index - 1];
            const upperBound = d;
            const formatDisplay = v => state.isRatioField ? `${formatNumber(v)}:1` : formatNumber(v);
            state.tooltip.transition().duration(200).style("opacity", 0.9);
            state.tooltip.html(`Range: ${formatDisplay(lowerBound)} – ${formatDisplay(upperBound)}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
            highlightCounties(d);
        })
        .on("mouseout", function () {
            state.tooltip.transition().duration(200).style("opacity", 0);
            unhighlightCounties();
        });

    // lollipop circles (smaller circles)
    chart.selectAll(".break-circle")
        .data(breaksArray)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d))
        .attr("cy", d => yScale(d))
        .attr("r", getCircleRadius())
        .style("fill", d => colorScale(d))
        .each(function () { d3.select(this).raise(); })
        .on("mouseover", function (event, d) {
            const index = breaksArray.indexOf(d);
            const lowerBound = index === 0 ? d3.min(expressedValues) : breaksArray[index - 1];
            const upperBound = d;
            const formatDisplay = v => state.isRatioField ? `${formatNumber(v)}:1` : formatNumber(v);
            state.tooltip.transition().duration(200).style("opacity", 0.9);
            state.tooltip.html(`Range: ${formatDisplay(lowerBound)} – ${formatDisplay(upperBound)}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
            highlightCounties(d);
        })
        .on("mouseout", function () {
            state.tooltip.transition().duration(200).style("opacity", 0);
            unhighlightCounties();
        });

    // Function to dynamically get circle radius based on screen size
    function getCircleRadius() {
        const screenWidth = window.innerWidth;
        if (screenWidth <= 600) { // Small screens (phones)
            return 15; // Larger circle for better hover interaction on smaller screens
        }
        return 10; // Default circle size for larger screens
    }

// Create x-axis with ticks and rotation
const xAxis = d3.axisBottom(xScale)
    .tickFormat(function (d) {
        const index = breaksArray.indexOf(d);
        const upperBound = d; // upper bound is the current tick value
        const formatDisplay = v => state.isRatioField ? `${formatNumber(v)}:1` : formatNumber(v);

        // Round the upperBound before formatting
        const roundedUpperBound = Math.round(upperBound);
        return `< ${formatDisplay(roundedUpperBound)}`;
    });

// x-axis group with transform, rotation, and font size adjustments
chart.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${chartInnerHeight})`)
    .call(xAxis)
    .selectAll("text")
    .attr("transform", "rotate(45)")
    .style("text-anchor", "start")
    .style("font-size", getFontSize())
    .style("fill", "white")
    .attr("y", 3)
    .attr("x", 8);

// Create horizontal line at 0 on the y-axis (ensure it is visible)
chart.append("line")
    .attr("class", "x-axis-line")
    .attr("x1", 0)
    .attr("x2", chartInnerWidth)
    .attr("y1", yScale(0)-3)
    .attr("y2", yScale(0)-3)
    .attr("stroke", "white")
    .attr("stroke-width", 0.7);

// y axis with dynamic font size
const yAxis = d3.axisLeft(yScale).ticks(5);
chart.append("g")
    .attr("class", "axis")
    .call(yAxis)
    .selectAll("text")
    .style("font-size", getFontSize());

    svg.append("text")
    .attr("class", "y-axis-label")
    .attr("x", -(chartInnerHeight / 2) - 50)
    .attr("y", -40)
    .attr("transform", "rotate(-90)")
    .style("text-anchor", "middle")
    .style("font-size", "1rem")
    .style("fill", "white")
    .style("font-weight", "600")
    .text("Home Sale Price");

    console.log("chartInnerWidth:", chartInnerWidth, "chartInnerHeight:", chartInnerHeight);

    if (chartInnerWidth = -70) { chartInnerWidth = 0; } else { svgWidth - margin.left - margin.right;}

    // chart frame
    chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight);

    // chart title with dynamic font size
    svg.append("text")
    .attr("class", "chartTitle")
    .attr("x", chartInnerWidth / 2)
    .attr("y", 20)
    .attr("text-anchor", "start")
    .style("font-size", getFontSize())
    .style("font-weight", "600")
    .text(() => {
        // Parse the date and format it to 'Month/Year'
        const date = new Date(state.expressed);
        const month = date.toLocaleString('default', { month: 'long' });
        const year = date.getFullYear();
        return `${month} ${year}`;
    });

    // data source
    // const leftPadding = margin.left + 10;
    // svg.append("a")
    //     .attr("xlink:href", "https://www.zillow.com/research/data/")
    //     .attr("target", "_blank")
    //     .append("text")
    //     .attr("class", "attribution")
    //     .attr("x", leftPadding)
    //     .attr("y", svgHeight - 10)
    //     .attr("text-anchor", "start")
    //     .style("font-size", "0.7rem")
    //     .style("fill", "#999")
}