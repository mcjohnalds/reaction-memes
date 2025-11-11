const input = document.body.querySelector("input");
const columns = document.body.querySelector(".columns");
const results = document.getElementById("results");
let searchCounter = 0;
let searchTimeoutId = null;

input.addEventListener("input", () => {
  if (searchTimeoutId !== null) {
    clearTimeout(searchTimeoutId);
  }
  searchTimeoutId = setTimeout(search, 200);
});

async function search() {
  searchCounter++;
  const counter = searchCounter;
  const params = new URLSearchParams({ query: input.value });
  const res = await fetch(`/search?${params}`);
  const html = await res.text();
  if (searchCounter != counter) {
    return;
  }
  results.innerHTML = html;
  const columnCount = Math.floor(columns.clientWidth / 200);
  columns.innerHTML = "<div></div>".repeat(columnCount);
  for (let i = 0; i < results.content.children.length; i++) {
    const result = results.content.children[i];
    const columnIndex = i % columnCount;
    columns.children[columnIndex].appendChild(result.cloneNode(true));
  }
}

search();
