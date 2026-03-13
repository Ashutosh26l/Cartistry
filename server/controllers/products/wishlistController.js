import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import { getSafeRedirectPath, hasStock } from "./productShared.js";

export const toggleWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const redirectPath = getSafeRedirectPath(req.body.redirectTo, "/products/allProducts");
    const product = await Product.findById(id).select("_id");
    if (!product) {
      req.flash("error", "Product not found");
      return res.redirect(redirectPath);
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).redirect("/auth/login");

    const existingIndex = (user.wishlist || []).findIndex((productId) => productId.toString() === id);
    if (existingIndex >= 0) {
      user.wishlist.splice(existingIndex, 1);
      req.flash("success", "Removed from wishlist");
    } else {
      user.wishlist.push(product._id);
      req.flash("success", "Added to wishlist");
    }

    await user.save();
    return res.redirect(redirectPath);
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to update wishlist" });
  }
};

export const getWishlistPage = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("wishlist");
    if (!user) return res.status(401).redirect("/auth/login");

    const wishlistItems = (user.wishlist || []).filter(Boolean).map((item) => {
      const product = item.toObject();
      product.isAvailable = hasStock(product);
      product.isWishlisted = true;
      return product;
    });

    return res.render("wishlist", { wishlistItems });
  } catch (error) {
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load wishlist" });
  }
};
