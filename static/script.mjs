const inputWrapper = document.body.querySelector(".inputWrapper");
const input = document.body.querySelector("input");
const columns = document.body.querySelector(".columns");
let images = window.initialImages;
let searchCounter = 0;
let replaceColumnsCounter = 0;
let searchTimeoutId = null;
let resizeTimeoutId = null;

window.addEventListener("resize", () => {
  if (resizeTimeoutId !== null) {
    clearTimeout(resizeTimeoutId);
  }
  resizeTimeoutId = setTimeout(replaceColumns, 200);
});

inputWrapper.addEventListener("click", () => {
  input.focus();
});

input.addEventListener("input", () => {
  if (searchTimeoutId !== null) {
    clearTimeout(searchTimeoutId);
  }
  searchTimeoutId = setTimeout(search, 400);
});

async function search() {
  searchCounter++;
  const counter = searchCounter;
  const params = new URLSearchParams({ query: input.value });
  const res = await fetch(`/search?${params}`);
  const json = await res.json();
  if (searchCounter !== counter) {
    return;
  }
  images = json;
  replaceColumns();
}

async function replaceColumns() {
  replaceColumnsCounter++;
  const counter = replaceColumnsCounter;
  const columnCount = Math.floor(columns.clientWidth / 200);
  columns.innerHTML = "<div></div>".repeat(columnCount);
  for (let i = 0; i < images.length; i++) {
    const img = document.createElement("img");
    img.src = `images/${images[i]}`;
    const columnIndex = i % columnCount;
    columns.children[columnIndex].appendChild(img);
    // Let thread breathe
    await new Promise((r) => setTimeout(r, 0));
    if (replaceColumnsCounter !== counter) {
      return;
    }
  }
}

replaceColumns();
