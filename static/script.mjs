class AppElement extends HTMLElement {
  #searchCounter = 0;
  #searchTimeoutId = null;

  get #input() {
    return this.querySelector("& > x-search-input");
  }

  get #mosaic() {
    return this.querySelector("& > x-mosaic");
  }

  connectedCallback() {
    this.#input.addEventListener("input", () => {
      if (this.#searchTimeoutId !== null) {
        clearTimeout(this.#searchTimeoutId);
      }
      this.#searchTimeoutId = setTimeout(() => this.#search(), 400);
    });
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

class SearchInput extends HTMLElement {
  get value() {
    return this.#input.value;
  }

  get #input() {
    return this.querySelector("input");
  }

  connectedCallback() {
    this.addEventListener("click", () => {
      this.#input.focus();
    });
    this.#input.addEventListener("input", () => {
      this.dispatchEvent(new Event("input"));
    });
    // When switching to a tab, Safari scrolls to the focused input. So if the
    // user scrolls halfway down the page, then they go to a different tab, then
    // they come back, they will be at the top of the page. Not good.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.#input.blur();
      }
    });
  }
}

class MosaicElement extends HTMLElement {
  static #pageSize = 50;
  #loading = false;
  #counter = 0;
  #images = [];
  #page = 0;
  #resizeTimeoutId = null;
  #clientWidthPrevious;

  get loading() {
    return this.#loading;
  }

  connectedCallback() {
    window.addEventListener("resize", () => {
      this.#handleResize();
    });
    this.#loadPage();
    this.#startInfiniteScrollLoop();
  }

  async #handleResize() {
    if (this.clientWidth === this.#clientWidthPrevious) {
      // Safari on iOS seems to emit resize events even when nothing changes.
      // Without this return, scrolling is glitchy.
      return;
    }
    this.#clientWidthPrevious = this.clientWidth;
    if (this.#resizeTimeoutId !== null) {
      clearTimeout(this.#resizeTimeoutId);
    }
    this.#resizeTimeoutId = setTimeout(
      () => this.loadImages(this.#images),
      100,
    );
  }

  loadImages(value) {
    this.#page = 0;
    this.#images = value;
    const columnCount = Math.max(Math.floor(this.clientWidth / 150), 2);
    this.innerHTML = "<div></div>".repeat(columnCount);
    this.#loadPage();
  }

  // Not pretty but optimized for good FPS. Do not change without profiling.
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
      const item = this.#createItem(this.#images[i]);
      this.children[columnIndex].appendChild(item);
      // Let thread breathe
      await new Promise((r) => setTimeout(r, 0));
      if (this.#counter !== counter) {
        return;
      }
    }
    this.#loading = false;
  }

  #createItem(image) {
    // Calling createElement instead of using innerHTML or something boosts FPS
    // a ton
    const a = document.createElement("a");
    a.href = `/images/${image}`;
    a.target = "_blank";
    const img = document.createElement("img");
    img.src = `/thumbnails/${image}`;
    a.appendChild(img);
    return a;
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

customElements.define("x-search-input", SearchInput);
customElements.define("x-mosaic", MosaicElement);
customElements.define("x-app", AppElement);
