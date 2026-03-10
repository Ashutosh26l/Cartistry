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

  searchInput.addEventListener(
    "input",
    debounce((event) => {
      redirectWithQuery(event.target.value);
    }, 220)
  );

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    redirectWithQuery(searchInput.value);
  });
}
