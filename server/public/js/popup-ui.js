(() => {
  const body = document.body;
  if (!body) return;

  const state = {
    toastRoot: null,
    modalRoot: null,
  };

  const createToastRoot = () => {
    if (state.toastRoot) return state.toastRoot;
    const root = document.createElement("div");
    root.className = "fixed top-4 right-4 z-[120] flex w-[92vw] max-w-sm flex-col gap-2";
    document.body.appendChild(root);
    state.toastRoot = root;
    return root;
  };

  const showToast = (message, type = "success", timeout = 2600) => {
    if (!message) return;
    const root = createToastRoot();
    const tone =
      type === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
    const toast = document.createElement("div");
    toast.className =
      `rounded-xl border px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ${tone} translate-y-2 opacity-0`;
    toast.textContent = message;
    root.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove("translate-y-2", "opacity-0");
    });

    window.setTimeout(() => {
      toast.classList.add("translate-y-2", "opacity-0");
      window.setTimeout(() => toast.remove(), 260);
    }, timeout);
  };

  const createModalRoot = () => {
    if (state.modalRoot) return state.modalRoot;
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[130] hidden items-center justify-center bg-slate-900/50 p-4";
    overlay.innerHTML = `
      <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h3 class="js-popup-title text-lg font-bold text-slate-900">Please confirm</h3>
        <p class="js-popup-message mt-2 text-sm text-slate-600"></p>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="js-popup-cancel rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
          <button type="button" class="js-popup-confirm rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Continue</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    state.modalRoot = overlay;
    return overlay;
  };

  const openConfirm = ({ title, message, confirmText = "Continue", cancelText = "Cancel" }) =>
    new Promise((resolve) => {
      const root = createModalRoot();
      const titleEl = root.querySelector(".js-popup-title");
      const messageEl = root.querySelector(".js-popup-message");
      const confirmBtn = root.querySelector(".js-popup-confirm");
      const cancelBtn = root.querySelector(".js-popup-cancel");
      if (!titleEl || !messageEl || !confirmBtn || !cancelBtn) return resolve(false);

      titleEl.textContent = title || "Please confirm";
      messageEl.textContent = message || "";
      confirmBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;
      root.classList.remove("hidden");
      root.classList.add("flex");

      const close = (decision) => {
        root.classList.remove("flex");
        root.classList.add("hidden");
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
        root.removeEventListener("click", onBackdrop);
        resolve(decision);
      };

      const onConfirm = () => close(true);
      const onCancel = () => close(false);
      const onBackdrop = (event) => {
        if (event.target === root) close(false);
      };

      confirmBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel);
      root.addEventListener("click", onBackdrop);
    });

  const openInfo = ({ title = "Notice", message, buttonText = "OK" }) =>
    openConfirm({
      title,
      message,
      confirmText: buttonText,
      cancelText: "Close",
    });

  const bindFlashToasts = () => {
    document.querySelectorAll(".js-flash-message").forEach((node) => {
      const message = node.getAttribute("data-flash-message");
      const type = node.getAttribute("data-flash-type") || "success";
      showToast(message, type);
    });
  };

  const bindConfirmForms = () => {
    document.querySelectorAll("form[data-confirm-message]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        if (form.dataset.confirmed === "true") {
          form.dataset.confirmed = "";
          return;
        }
        event.preventDefault();
        const ok = await openConfirm({
          title: "Are you sure?",
          message: form.getAttribute("data-confirm-message") || "",
          confirmText: form.getAttribute("data-confirm-cta") || "Yes",
          cancelText: "Cancel",
        });
        if (!ok) return;
        form.dataset.confirmed = "true";
        form.submit();
      });
    });
  };

  const bindPermissionPopups = () => {
    const role = body.getAttribute("data-user-role") || "guest";
    const isAuthenticated = body.getAttribute("data-authenticated") === "true";

    document.querySelectorAll("[data-permission-message]").forEach((item) => {
      item.addEventListener("click", async (event) => {
        const needsAuth = item.getAttribute("data-requires-auth") === "true";
        const needsAdmin = item.getAttribute("data-admin-only") === "true";
        const blocked = (needsAuth && !isAuthenticated) || (needsAdmin && role !== "admin");
        if (!blocked) return;

        event.preventDefault();
        const message = item.getAttribute("data-permission-message");
        await openInfo({ title: "Access restricted", message, buttonText: "Understood" });

        const loginUrl = item.getAttribute("data-login-url");
        if (needsAuth && !isAuthenticated && loginUrl) {
          window.location.href = loginUrl;
        }
      });
    });
  };

  const bindSmartSuggestions = () => {
    document.querySelectorAll("[data-smart-suggestion]").forEach((item) => {
      item.addEventListener("click", async (event) => {
        if (item.dataset.smartSuggestionDone === "true") return;
        const template = item.getAttribute("data-smart-suggestion") || "";
        if (!template) return;

        const threshold = Number(item.getAttribute("data-checkout-threshold") || 0);
        const current = Number(item.getAttribute("data-current-total") || 0);
        const shouldCheckThreshold = threshold > 0;
        if (shouldCheckThreshold && current >= threshold) return;

        event.preventDefault();
        const shortfall = Math.max(0, threshold - current);
        const message = template.includes("{{amount}}") ? template.replace("{{amount}}", String(shortfall)) : template;
        const cancelText = shouldCheckThreshold ? "Add products" : "Go back";
        const shouldContinue = await openConfirm({
          title: "Smart suggestion",
          message,
          confirmText: "Continue anyway",
          cancelText,
        });
        if (!shouldContinue) return;

        item.dataset.smartSuggestionDone = "true";
        if (item.tagName === "A") {
          window.location.href = item.getAttribute("href") || "#";
          return;
        }
        item.click();
      });
    });
  };

  const bindUnsavedGuards = () => {
    document.querySelectorAll("form[data-unsaved-tracker]").forEach((form) => {
      let dirty = false;
      const markDirty = () => {
        dirty = true;
      };
      form.addEventListener("input", markDirty);
      form.addEventListener("change", markDirty);
      form.addEventListener("submit", () => {
        dirty = false;
      });

      const cancelSelector = form.getAttribute("data-cancel-target");
      if (!cancelSelector) return;
      document.querySelectorAll(cancelSelector).forEach((cancelLink) => {
        cancelLink.addEventListener("click", async (event) => {
          if (!dirty) return;
          event.preventDefault();
          const ok = await openConfirm({
            title: "Discard changes?",
            message:
              cancelLink.getAttribute("data-confirm-message") ||
              "You have unsaved changes. Do you want to discard them?",
            confirmText: "Discard",
            cancelText: "Keep editing",
          });
          if (ok) window.location.href = cancelLink.getAttribute("href") || "#";
        });
      });
    });
  };

  const bindAutoPopups = () => {
    document.querySelectorAll("[data-auto-popup-message]").forEach((item) => {
      const message = item.getAttribute("data-auto-popup-message");
      if (!message) return;
      openInfo({ title: "Smart suggestion", message, buttonText: "Got it" });
    });
  };

  window.AppPopup = {
    showToast,
    openConfirm,
    openInfo,
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindFlashToasts();
    bindConfirmForms();
    bindPermissionPopups();
    bindSmartSuggestions();
    bindUnsavedGuards();
    bindAutoPopups();
  });
})();
