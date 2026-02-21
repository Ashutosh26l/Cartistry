(() => {
  const storageKey = "theme";
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");

  const applyTheme = (isDark) => {
    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
    if (toggle) {
      toggle.textContent = isDark ? "Light" : "Dark";
      toggle.setAttribute("aria-pressed", String(isDark));
    }
  };

  const savedTheme = localStorage.getItem(storageKey);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme ? savedTheme === "dark" : prefersDark;
  applyTheme(isDark);

  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const nextIsDark = !root.classList.contains("dark");
    localStorage.setItem(storageKey, nextIsDark ? "dark" : "light");
    applyTheme(nextIsDark);
  });
})();
