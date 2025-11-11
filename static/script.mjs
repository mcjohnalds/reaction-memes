const input = document.body.querySelector("input");
const results = document.body.querySelector(".results");
let submitCounter = 0;
let timeoutId = null;

input.addEventListener("input", () => {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
  }
  timeoutId = setTimeout(search, 200);
});

async function search() {
  submitCounter++;
  const counter = submitCounter;
  const params = new URLSearchParams({ query: input.value });
  const res = await fetch(`/search?${params}`);
  const html = await res.text();
  if (submitCounter != counter) {
    return;
  }
  results.innerHTML = html;
}
