const now = Date.now();
// break browser cache ()
Promise.all([
  import(`./globals.js?v=${now}`),
  import(`./map.js?v=${now}`),
  import(`./chart.js?v=${now}`),
  import(`./data.js?v=${now}`)
]).then(([main, map, chart, data]) => {
  // Start the app
  map.setMap();
}).catch(err => {
  console.error("Dynamic module load failed:", err);
});
