class SearchFormHTMLElement extends HTMLElement {
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

class MosaicHTMLElement extends HTMLElement {
  connectedCallback() {
    const columnWidth = 200;
    const columnCount = Math.max(Math.floor(this.clientWidth / columnWidth), 2);
    const fragment = new DocumentFragment();
    // TODO: profile with vs without fragment optimization
    for (let i = 0; i < columnCount; i++) {
      fragment.appendChild(document.createElement("div"));
    }
    for (const [i, image] of window.images.entries()) {
      const columnCount = fragment.children.length;
      const columnIndex = i % columnCount;
      const item = this.#createItem(image);
      fragment.children[columnIndex].appendChild(item);
    }
    this.appendChild(fragment);
  }

  #createItem(image) {
    // TODO: see if I can use innerHTML and get the same performance.
    const a = document.createElement("a");
    a.href = `/images/${image.file}`;
    a.target = "_blank";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.width = image.width;
    img.height = image.height;
    a.appendChild(img);
    // TODO: optimize away the stutter during image load. Last resort: set
    // img.src in a queue.
    //
    // TODO: try delaying setting src to reduce how many images get loaded
    // initially
    img.src = `/thumbnails/${image.file}`;
    return a;
  }
}

customElements.define("x-search-form", SearchFormHTMLElement);
customElements.define("x-mosaic", MosaicHTMLElement);
