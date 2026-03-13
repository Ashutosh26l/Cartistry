export const setCookie = (req, res) => {
  res.cookie("mode", "light");
  res.cookie("location", "delhi");
  res.cookie("username", "samarth");
  return res.send("sent you a cookie successfully");
};

export const greetFromCookie = (req, res) => {
  const { username } = req.cookies;
  return res.send(`hi bro ${username || "anonymous"} hope you r doing good`);
};

export const getSignedCookie = (req, res) => {
  res.cookie("earthquake", "aaya", { signed: true });
  return res.send("cookie sent successfully");
};

export const showSignedCookies = (req, res) => {
  return res.send(req.signedCookies);
};

export const viewCount = (req, res) => {
  if (req.session.count) req.session.count += 1;
  else req.session.count = 1;

  return res.send(`You visited counter ${req.session.count} times`);
};

export const setSessionName = (req, res) => {
  req.session.username = "samarth vohra";
  return res.redirect("/greet-session");
};

export const greetFromSession = (req, res) => {
  const { username = "anonymous" } = req.session;
  return res.send(`hi from ${username}`);
};
