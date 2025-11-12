class AppElement extends HTMLElement {
  #searchCounter = 0;
  #searchTimeoutId = null;

  get #inputWrapper() {
    return this.querySelector("& > .inputWrapper");
  }

  get #input() {
    return this.querySelector("& > .inputWrapper > input");
  }

  get #mosaic() {
    return this.querySelector("& > x-mosaic");
  }

  connectedCallback() {
    this.#inputWrapper.addEventListener("click", () => {
      this.#input.focus();
    });
    this.#input.addEventListener("input", () => {
      if (this.#searchTimeoutId !== null) {
        clearTimeout(this.#searchTimeoutId);
      }
      this.#searchTimeoutId = setTimeout(() => this.#search(), 400);
    });
    customElements.upgrade(this.#mosaic);
    this.#mosaic.loadImages(window.initialImages);
  }

  async #search() {
    this.#searchCounter++;
    const counter = this.#searchCounter;
    const params = new URLSearchParams({ query: this.#input.value });
    const res = await fetch(`/search?${params}`);
    const images = await res.json();
    if (this.#searchCounter !== counter) {
      return;
    }
    this.#mosaic.loadImages(images);
  }
}

class MosaicElement extends HTMLElement {
  static #pageSize = 50;
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
    const start = this.#page * MosaicElement.#pageSize;
    const end = Math.min(
      (this.#page + 1) * MosaicElement.#pageSize,
      this.#images.length,
    );
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

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

customElements.define("x-mosaic", MosaicElement);
customElements.define("x-app", AppElement);
