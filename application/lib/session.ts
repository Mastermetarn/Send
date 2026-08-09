export const SESSION_COOKIE_NAME = "send_session";
export const SESSION_MAX_AGE_DAYS = 30;

export const SESSION_COOKIE_SECURE =
  process.env.SESSION_COOKIE_SECURE === "false"
    ? false
    : process.env.NODE_ENV === "production";
