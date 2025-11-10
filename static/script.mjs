const input = document.body.querySelector("input");
const form = document.body.querySelector("form");
const results = document.body.querySelector(".results");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const params = new URLSearchParams({ query: input.value });
  const res = await fetch(`/search?${params}`);
  results.innerHTML = await res.text();
});
