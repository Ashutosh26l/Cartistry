import Product from "../models/productModel.js";

// Home route serves a role-based dashboard for logged-in users.
export const renderHome = async (req, res) => {
  try {
    if (!res.locals.currentUser) {
      return res.render("home");
    }

    const userRole = res.locals.currentUser.role;
    if (userRole === "buyer") {
      const [featuredProducts, latestProducts] = await Promise.all([
        Product.find({ isAvailable: true }).sort({ createdAt: -1 }).limit(6),
        Product.find().sort({ createdAt: -1 }).limit(4),
      ]);

      return res.render("buyer_dashboard", { featuredProducts, latestProducts });
    }

    const ownerFilter = { owner: req.user.id };
    const [totalProducts, inStockProducts, featuredProducts] = await Promise.all([
      Product.countDocuments(ownerFilter),
      Product.countDocuments({ ...ownerFilter, isAvailable: true }),
      Product.find(ownerFilter).sort({ _id: -1 }).limit(4),
    ]);

    const outOfStockProducts = totalProducts - inStockProducts;
    const averagePrice =
      featuredProducts.length > 0
        ? Math.round(
            featuredProducts.reduce((sum, item) => sum + Number(item.price || 0), 0) /
              featuredProducts.length
          )
        : 0;

    return res.render("dashboard", {
      stats: {
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        averagePrice,
      },
      featuredProducts,
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    return res.status(500).render("error", { statusCode: 500, message: "Unable to load dashboard" });
  }
};

export const getApiHealth = (req, res) => {
  return res.status(200).json({ message: "Inventory API is running" });
};

export const getHealth = (req, res) => {
  return res.status(200).json({ ok: true, uptime: process.uptime() });
};

export const renderHelpCenter = (req, res) => {
  return res.render("help_center");
};

export const renderReturns = (req, res) => {
  return res.render("returns");
};

export const renderShipping = (req, res) => {
  return res.render("shipping");
};
