// globals
export const state = {
  map: null,
  projection: null,
  path: null,
  colorScale: null,
  priceByCounty: null,
  attrArray: null,
  expressed: null,
  tooltip: null,
  isRatioField: false,
};
// Side bar logic
export function initSidebarToggle() {
  const sidebar = document.getElementById("sidebar");
  const tab = document.getElementById("sidebar-tab");
  const closeBtn = document.getElementById("close-sidebar");

  if (!sidebar || !tab || !closeBtn) {
    return;
  }

  // Open sidebar
  tab.onclick = () => {
    sidebar.classList.add("open");
  };

  // Close sidebar
  closeBtn.onclick = () => {
    sidebar.classList.remove("open");
  };
}

initSidebarToggle();


