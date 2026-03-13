export const attachFlashMessages = (req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
};

export default attachFlashMessages;
