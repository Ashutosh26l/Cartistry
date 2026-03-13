import Product from "../../models/productModel.js";
import { getOwnerFilter } from "./productShared.js";

export const addProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    if (res.locals.currentUser?.role !== "buyer") {
      req.flash("error", "Only buyers can add reviews");
      return res.redirect(`/products/${id}`);
    }

    const currentUserName = String(res.locals.currentUser?.name || "").trim();
    const parsedRating = Number(rating);

    if (!currentUserName || !comment || Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      req.flash("error", "Please provide a valid review");
      return res.redirect(`/products/${id}`);
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id },
      {
        $push: {
          reviews: {
            userName: currentUserName,
            rating: parsedRating,
            comment: String(comment).trim(),
          },
        },
      },
      { new: true }
    );

    if (!updatedProduct) return res.status(403).send("Forbidden");
    req.flash("success", "Review added successfully");
    return res.redirect(`/products/${id}`);
  } catch (error) {
    req.flash("error", "Unable to add review");
    return res.status(500).render("error", { statusCode: 500, message: "Unable to add review" });
  }
};

export const replyToReview = async (req, res) => {
  try {
    const { id, reviewIndex } = req.params;
    const parsedIndex = Number(reviewIndex);
    if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
      req.flash("error", "Invalid review selected");
      return res.redirect(`/products/${id}`);
    }

    const product = await Product.findOne({ _id: id, ...getOwnerFilter(req) });
    if (!product) {
      req.flash("error", "Retailer access only");
      return res.status(403).redirect("/products/allProducts");
    }

    if (!Array.isArray(product.reviews) || parsedIndex >= product.reviews.length) {
      req.flash("error", "Review not found");
      return res.redirect(`/products/${id}`);
    }

    const replyText = String(req.body.reply || "").trim();
    if (!replyText) {
      req.flash("error", "Reply cannot be empty");
      return res.redirect(`/products/${id}`);
    }

    product.reviews[parsedIndex].retailerReply = replyText;
    product.reviews[parsedIndex].repliedBy = String(res.locals.currentUser?.name || "Retailer").trim();
    product.reviews[parsedIndex].repliedAt = new Date();
    await product.save();

    req.flash("success", "Reply posted successfully.");
    return res.redirect(`/products/${id}`);
  } catch (error) {
    req.flash("error", "Unable to post reply");
    return res.status(500).render("error", { statusCode: 500, message: "Unable to post reply" });
  }
};
