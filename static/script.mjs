const inputWrapper = document.body.querySelector(".inputWrapper");
const input = document.body.querySelector("input");
const columns = document.body.querySelector(".columns");
const pageSize = 50;
let images = window.initialImages;
let addingImages = false;
let page = 0;
let searchCounter = 0;
let addImagesCounter = 0;
let searchTimeoutId = null;
let resizeTimeoutId = null;

window.addEventListener("resize", () => {
  if (resizeTimeoutId !== null) {
    clearTimeout(resizeTimeoutId);
  }
  resizeTimeoutId = setTimeout(replaceColumns, 200);
});

async function startInfiniteScrollLoop() {
  while (true) {
    await wait(200);
    if (addingImages) {
      continue;
    }
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight < scrollHeight * 0.8) {
      continue;
    }
    page++;
    addImages(images);
  }
}

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
  page = 0;
  replaceColumns();
}

async function replaceColumns() {
  const columnCount = Math.floor(columns.clientWidth / 200);
  columns.innerHTML = "<div></div>".repeat(columnCount);
  await addImages();
}

async function addImages() {
  addingImages = true;
  addImagesCounter++;
  const counter = addImagesCounter;
  const start = page * pageSize;
  const end = Math.min((page + 1) * pageSize, images.length);
  const columnCount = columns.children.length;
  for (let i = start; i < end; i++) {
    const img = document.createElement("img");
    img.src = `images/${images[i]}`;
    const columnIndex = i % columnCount;
    columns.children[columnIndex].appendChild(img);
    // Let thread breathe
    await new Promise((r) => setTimeout(r, 0));
    if (addImagesCounter !== counter) {
      return;
    }
  }
  addingImages = false;
}

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

startInfiniteScrollLoop();
replaceColumns();
