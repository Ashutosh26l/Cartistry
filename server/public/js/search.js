function debounce(func, delay) {
  let timer;
  const debounced = function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

const AUTO_SEARCH_DELAY_MS = 750;
const MIN_AUTO_SEARCH_LENGTH = 2;
const searchInput = document.getElementById("searchInput");
const searchForm = document.getElementById("searchForm");
const isProductsPage = window.location.pathname === "/products/allProducts";

if (searchInput && searchForm) {
  const currentUrl = new URL(window.location.href);
  searchInput.value = currentUrl.searchParams.get("q") || "";

  const redirectWithQuery = (rawQuery) => {
    const query = rawQuery.trim();
    const targetUrl = isProductsPage ? new URL(window.location.href) : new URL(searchForm.action, window.location.origin);

    if (query) {
      targetUrl.searchParams.set("q", query);
    } else {
      targetUrl.searchParams.delete("q");
    }

    if (isProductsPage) {
      targetUrl.searchParams.delete("page");
    }

    if (window.location.href !== targetUrl.toString()) {
      window.location.href = targetUrl.toString();
    }
  };

  const debouncedAutoSearch = debounce((rawQuery) => {
    const query = rawQuery.trim();
    if (query.length > 0 && query.length < MIN_AUTO_SEARCH_LENGTH) return;
    redirectWithQuery(query);
  }, AUTO_SEARCH_DELAY_MS);

  let isComposingText = false;

  searchInput.addEventListener("compositionstart", () => {
    isComposingText = true;
    debouncedAutoSearch.cancel();
  });

  searchInput.addEventListener("compositionend", () => {
    isComposingText = false;
    debouncedAutoSearch(searchInput.value);
  });

  searchInput.addEventListener("input", (event) => {
    if (isComposingText || event.isComposing) return;
    debouncedAutoSearch(event.target.value);
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    debouncedAutoSearch.cancel();
    redirectWithQuery(searchInput.value);
  });
}
