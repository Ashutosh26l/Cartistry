(() => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canAnimate = () => Boolean(window.gsap) && !prefersReducedMotion;

  const animateCards = () => {
    const cards = document.querySelectorAll("[data-animate-card]");
    if (!cards.length) return;
    window.gsap.from(cards, {
      opacity: 0,
      y: 22,
      duration: 0.55,
      ease: "power2.out",
      stagger: 0.07,
      clearProps: "all",
    });
  };

  const animateCounters = () => {
    const counters = document.querySelectorAll("[data-animate-counter]");
    counters.forEach((el) => {
      const target = Number(el.getAttribute("data-counter-value") || 0);
      if (Number.isNaN(target)) return;
      const prefix = el.getAttribute("data-counter-prefix") || "";
      const roundedTarget = Math.max(0, Math.round(target));
      const formatValue = (value) => `${prefix}${Math.max(0, Math.round(value)).toLocaleString("en-IN")}`;
      const finalText = formatValue(roundedTarget);

      // Lock number width to prevent card jitter during animated count updates.
      el.style.display = "inline-block";
      el.style.whiteSpace = "nowrap";
      el.style.minWidth = `${Math.max(finalText.length, 4)}ch`;
      el.style.fontVariantNumeric = "tabular-nums";
      el.style.fontFeatureSettings = '"tnum" 1, "lnum" 1';

      const value = { current: 0 };
      el.textContent = formatValue(0);
      window.gsap.to(value, {
        current: roundedTarget,
        duration: 1.2,
        ease: "power2.out",
        snap: { current: 1 },
        onUpdate: () => {
          el.textContent = formatValue(value.current);
        },
        onComplete: () => {
          el.textContent = finalText;
        },
      });
    });
  };

  const animateCtas = () => {
    const ctas = document.querySelectorAll("[data-animate-cta]");
    if (!ctas.length) return;
    window.gsap.from(ctas, {
      opacity: 0,
      y: 12,
      duration: 0.45,
      ease: "power2.out",
      stagger: 0.08,
      delay: 0.12,
      clearProps: "all",
    });
  };

  const animateWishlistButtons = () => {
    const buttons = document.querySelectorAll("form[action*='/wishlist'] button");
    buttons.forEach((button) => {
      button.addEventListener("mouseenter", () => {
        window.gsap.to(button, { scale: 1.08, duration: 0.18, ease: "power1.out" });
      });
      button.addEventListener("mouseleave", () => {
        window.gsap.to(button, { scale: 1, duration: 0.2, ease: "power1.out" });
      });
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (!canAnimate()) return;
    animateCards();
    animateCounters();
    animateCtas();
    animateWishlistButtons();
  });
})();
