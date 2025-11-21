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

class MosaicHTMLElement extends HTMLElement {
  connectedCallback() {
    const columnWidth = 200;
    const columnCount = Math.max(Math.floor(this.clientWidth / columnWidth), 2);
    for (let i = 0; i < columnCount; i++) {
      this.appendChild(document.createElement("div"));
    }
    for (const [i, image] of window.images.entries()) {
      const columnIndex = i % columnCount;
      const item = this.#createItem(image);
      this.children[columnIndex].appendChild(item);
    }
  }

  #createItem(image) {
    const template = document.createElement("template");
    template.innerHTML = `
      <a href="/images/${image.file}" target="_blank">
        <img
          loading="lazy"
          width="${image.width}"
          height="${image.height}"
          src="/thumbnails/${image.file}"
        />
      </a>
    `;
    return template.content;
  }
}

customElements.define("x-search", SearchHTMLElement);
customElements.define("x-mosaic", MosaicHTMLElement);
