const mosaic = document.body.querySelector("x-mosaic");
const inputWrapper = document.body.querySelector(".inputWrapper");
const input = document.body.querySelector("input");
const pageSize = 50;
let searchCounter = 0;
let searchTimeoutId = null;

class MosaicElement extends HTMLElement {
  #loading = false;
  #counter = 0;
  #images = [];
  #page = 0;
  #resizeTimeoutId = null;

  get loading() {
    return this.#loading;
  }

  connectedCallback() {
    window.addEventListener("resize", () => {
      if (this.#resizeTimeoutId !== null) {
        clearTimeout(this.#resizeTimeoutId);
      }
      this.#resizeTimeoutId = setTimeout(() => this.loadImages(), 100);
    });
    this.#loadPage();
    this.#startInfiniteScrollLoop();
  }

  loadImages(value) {
    this.#page = 0;
    this.#images = value;
    const columnCount = Math.floor(this.clientWidth / 200);
    this.innerHTML = "<div></div>".repeat(columnCount);
    this.#loadPage();
  }

  async #loadPage() {
    this.#loading = true;
    this.#counter++;
    const counter = this.#counter;
    const start = this.#page * pageSize;
    const end = Math.min((this.#page + 1) * pageSize, this.#images.length);
    const columnCount = this.children.length;
    for (let i = start; i < end; i++) {
      const columnIndex = i % columnCount;
      const src = `images/${this.#images[i]}`;
      this.children[columnIndex].innerHTML += `
        <x-image>
          <img src="${src}" />
        </x-image>
      `;
      // Let thread breathe
      await new Promise((r) => setTimeout(r, 0));
      if (this.#counter !== counter) {
        return;
      }
    }
    this.#loading = false;
  }

  async #startInfiniteScrollLoop() {
    while (true) {
      await wait(200);
      if (this.#loading) {
        continue;
      }
      const { scrollTop, scrollHeight, clientHeight } =
        document.documentElement;
      if (scrollTop + clientHeight < scrollHeight * 0.8) {
        continue;
      }
      this.#page++;
      this.#loadPage();
    }
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
  const images = await res.json();
  if (searchCounter !== counter) {
    return;
  }
  mosaic.loadImages(images);
}

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

customElements.define("x-mosaic", MosaicElement);
mosaic.loadImages(window.initialImages);
