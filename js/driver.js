// break cache for mobile testing
const now = Date.now();
Promise.all([
  import(`./globals.js?v=${Date.now()}`),
  import(`./map.js?v=${Date.now()}`),
  import(`./chart.js?v=${Date.now()}`),
  import(`./data.js?v=${Date.now()}`)
]).then(([globals, map, chart, data]) => {
  map.setMap();
}).catch(err => {
  console.error("Dynamic import error:", err);
});
