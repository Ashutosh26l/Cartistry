const normalizeListInput = (value) => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item || "").split(/[\n,]/))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const dedupeCaseInsensitive = (items) => {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
};

const normalizeVariants = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const sizes = dedupeCaseInsensitive(normalizeListInput(source.sizes));
  const colors = dedupeCaseInsensitive(normalizeListInput(source.colors));
  return { sizes, colors };
};

const buildMessage = (details) => details.map((item) => item.message).join(", ");

export { buildMessage, dedupeCaseInsensitive, normalizeListInput, normalizeVariants };
