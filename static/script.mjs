class SearchForm extends HTMLElement {
  get #input() {
    return this.querySelector("input");
  }

  connectedCallback() {
    // Need this event handler so the user can click on the magnifying glass
    // icon
    this.addEventListener("click", () => {
      this.#input.focus();
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
  #loading = false;
  #counter = 0;
  // TODO: remove this variable
  #images = [];
  #imagesAdded = 0;
  #resizeTimeoutId = null;
  #clientWidthPrevious;

  get loading() {
    return this.#loading;
  }

  connectedCallback() {
    window.addEventListener("resize", () => {
      this.#handleResize();
    });
    this.#startInfiniteScrollLoop();
    this.#loadImages(window.images);
  }

  async #handleResize() {
    if (this.clientWidth === this.#clientWidthPrevious) {
      // Safari on iOS seems to emit resize events even when nothing changes.
      // Without this return, scrolling is glitchy.
      //
      // This happens only on physical iOS devices, not the simulator.
      return;
    }
    this.#clientWidthPrevious = this.clientWidth;
    if (this.#resizeTimeoutId !== null) {
      clearTimeout(this.#resizeTimeoutId);
    }
    this.#resizeTimeoutId = setTimeout(
      () => this.#loadImages(this.#images),
      100,
    );
  }

  // TODO: simplify this function
  #loadImages(value) {
    this.#imagesAdded = 0;
    this.#images = value;
    const columnWidth = 150;
    const columnCount = Math.max(Math.floor(this.clientWidth / columnWidth), 2);
    this.innerHTML = "<div></div>".repeat(columnCount);
    this.#loadPage();
  }

  // Not pretty but optimized for good FPS. Do not change without profiling.
  async #loadPage() {
    this.#loading = true;
    this.#counter++;
    const counter = this.#counter;
    while (true) {
      const { scrollHeight, clientHeight, scrollTop } =
        document.documentElement;
      if (scrollHeight > scrollTop + 2 * clientHeight) {
        break;
      }
      if (this.#imagesAdded === this.#images.length) {
        break;
      }
      const i = this.#imagesAdded;
      const columnCount = this.children.length;
      const columnIndex = i % columnCount;
      const item = this.#createItem(this.#images[i]);
      this.children[columnIndex].appendChild(item);
      this.#imagesAdded++;
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
      this.#loadPage();
    }
  }
}

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

customElements.define("x-search-form", SearchForm);
customElements.define("x-mosaic", MosaicElement);
