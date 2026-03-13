// Session config used by express-session middleware.
export const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
};

export default sessionConfig;
