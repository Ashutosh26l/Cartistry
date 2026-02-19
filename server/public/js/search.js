function debounce(func, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

const searchInput = document.getElementById("searchInput");
const searchForm = document.getElementById("searchForm");
const isProductsPage = window.location.pathname === "/products/allProducts";

const applyClientFilter = (query) => {
  const productLinks = Array.from(document.querySelectorAll('section a[href^="/products/"]')).filter(
    (anchor) => !anchor.getAttribute("href")?.startsWith("/products/allProducts")
  );

  if (!productLinks.length) return;

  const normalizedQuery = query.trim().toLowerCase();
  let visibleCount = 0;

  productLinks.forEach((card) => {
    const title = (card.querySelector("h3")?.textContent || "").toLowerCase();
    const matches = !normalizedQuery || title.includes(normalizedQuery);
    card.style.display = matches ? "" : "none";
    if (matches) visibleCount += 1;
  });

  let emptyMessage = document.getElementById("clientSearchEmptyState");
  if (!emptyMessage) {
    emptyMessage = document.createElement("div");
    emptyMessage.id = "clientSearchEmptyState";
    emptyMessage.className = "text-center py-12 w-full";
    emptyMessage.innerHTML = '<p class="text-gray-500 text-xl">No products found.</p>';

    const grid = document.querySelector("section .grid");
    if (grid) grid.appendChild(emptyMessage);
  }

  emptyMessage.style.display = visibleCount === 0 ? "block" : "none";
};

if (searchInput && searchForm) {
  const currentUrl = new URL(window.location.href);
  searchInput.value = currentUrl.searchParams.get("q") || "";

  searchInput.addEventListener(
    "input",
    debounce((event) => {
      const rawQuery = event.target.value;
      const query = rawQuery.trim();

      if (isProductsPage) {
        const url = new URL(window.location.href);
        if (query) url.searchParams.set("q", query);
        else url.searchParams.delete("q");
        window.history.replaceState({}, "", url.toString());
        applyClientFilter(rawQuery);
        return;
      }

      const targetUrl = new URL(searchForm.action, window.location.origin);
      if (query) targetUrl.searchParams.set("q", query);
      if (window.location.href !== targetUrl.toString()) {
        window.location.href = targetUrl.toString();
      }
    }, 150)
  );

  if (isProductsPage) {
    applyClientFilter(searchInput.value);
  }
}
