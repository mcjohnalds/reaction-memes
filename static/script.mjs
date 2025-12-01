class SearchHTMLElement extends HTMLElement {
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

// Optimized, do not change without profiling
class MosaicHTMLElement extends HTMLElement {
  connectedCallback() {
    const columnWidth = 200;
    const columnCount = Math.max(Math.floor(this.clientWidth / columnWidth), 2);
    const columnHeights = [];
    for (let i = 0; i < columnCount; i++) {
      this.appendChild(document.createElement("div"));
      columnHeights.push(0);
    }
    for (const image of window.images.values()) {
      const item = this.#createItem(image);
      let shortest = 0;
      for (let i = 0; i < columnCount; i++) {
        if (columnHeights[i] < columnHeights[shortest]) {
          shortest = i;
        }
      }
      this.children[shortest].appendChild(item);
      columnHeights[shortest] += image.height / image.width;
    }
  }

  #createItem(image) {
    const root = document.createElement("div");
    root.innerHTML = `
      <a href="/memes/${image.file}" target="_blank">
        <img
          loading="lazy"
          width="${image.width}"
          height="${image.height}"
          src="/thumbnails-new/${image.file}"
        />
      </a>
    `;
    return root.children[0];
  }
}

customElements.define("x-search", SearchHTMLElement);
customElements.define("x-mosaic", MosaicHTMLElement);
