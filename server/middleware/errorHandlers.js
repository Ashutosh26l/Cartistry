export const notFoundHandler = (req, res) => {
  return res.status(404).render("error", { statusCode: 404, message: "Page not found" });
};

export const errorHandler = (err, req, res, next) => {
  console.error("Unhandled error:", err);
  return res.status(err?.statusCode || 500).render("error", {
    statusCode: err?.statusCode || 500,
    message: err?.message || "Something went wrong",
  });
};
