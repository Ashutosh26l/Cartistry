import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let ioInstance = null;

const getProductRoom = (productId) => `product:${String(productId)}`;
const getRetailerRoom = (retailerId) => `retailer:${String(retailerId)}`;
const getBuyerRoom = (buyerId) => `buyer:${String(buyerId)}`;

const getCookieValue = (cookieHeader, key) => {
  if (!cookieHeader || !key) return "";
  const pairs = String(cookieHeader)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) continue;
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (name === key) {
      return decodeURIComponent(value);
    }
  }
  return "";
};

export const initSocketServer = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const token = getCookieValue(socket.handshake?.headers?.cookie, "token");
      if (!token || !process.env.JWT_SECRET) {
        socket.data.userId = "";
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = String(decoded?.userId || "");
      return next();
    } catch (error) {
      socket.data.userId = "";
      return next();
    }
  });

  ioInstance.on("connection", (socket) => {
    socket.on("product:join", (productId) => {
      if (!productId) return;
      socket.join(getProductRoom(productId));
    });

    socket.on("product:leave", (productId) => {
      if (!productId) return;
      socket.leave(getProductRoom(productId));
    });

    socket.on("retailer:join", (retailerId) => {
      const requestedRetailerId = String(retailerId || "");
      const authenticatedUserId = String(socket.data?.userId || "");
      if (!requestedRetailerId || !authenticatedUserId || requestedRetailerId !== authenticatedUserId) return;
      socket.join(getRetailerRoom(requestedRetailerId));
    });

    socket.on("retailer:leave", (retailerId) => {
      const requestedRetailerId = String(retailerId || "");
      const authenticatedUserId = String(socket.data?.userId || "");
      if (!requestedRetailerId || !authenticatedUserId || requestedRetailerId !== authenticatedUserId) return;
      socket.leave(getRetailerRoom(requestedRetailerId));
    });

    socket.on("buyer:join", (buyerId) => {
      const requestedBuyerId = String(buyerId || "");
      const authenticatedUserId = String(socket.data?.userId || "");
      if (!requestedBuyerId || !authenticatedUserId || requestedBuyerId !== authenticatedUserId) return;
      socket.join(getBuyerRoom(requestedBuyerId));
    });

    socket.on("buyer:leave", (buyerId) => {
      const requestedBuyerId = String(buyerId || "");
      const authenticatedUserId = String(socket.data?.userId || "");
      if (!requestedBuyerId || !authenticatedUserId || requestedBuyerId !== authenticatedUserId) return;
      socket.leave(getBuyerRoom(requestedBuyerId));
    });
  });

  return ioInstance;
};

export const emitReviewCreated = ({ productId, reviewIndex, review }) => {
  if (!ioInstance || !productId) return;
  ioInstance.to(getProductRoom(productId)).emit("review:created", {
    productId: String(productId),
    reviewIndex,
    review,
  });
};

export const emitReviewReplied = ({ productId, reviewIndex, reply }) => {
  if (!ioInstance || !productId) return;
  ioInstance.to(getProductRoom(productId)).emit("review:replied", {
    productId: String(productId),
    reviewIndex,
    reply,
  });
};

export const emitRetailerNotificationCreated = ({ retailerId, notification }) => {
  if (!ioInstance || !retailerId || !notification) return;
  ioInstance.to(getRetailerRoom(retailerId)).emit("retailer:notification:new", {
    retailerId: String(retailerId),
    notification,
  });
};

export const emitRetailerNotificationReplied = ({ retailerId, notification }) => {
  if (!ioInstance || !retailerId || !notification) return;
  ioInstance.to(getRetailerRoom(retailerId)).emit("retailer:notification:replied", {
    retailerId: String(retailerId),
    notification,
  });
};

export const emitBuyerNotificationReplied = ({ buyerId, notification }) => {
  if (!ioInstance || !buyerId || !notification) return;
  ioInstance.to(getBuyerRoom(buyerId)).emit("buyer:notification:new", {
    buyerId: String(buyerId),
    notification,
  });
};
