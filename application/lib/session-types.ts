export type AppSession = {
  cookie: {
    httpOnly: boolean;
    path: string;
    secure: boolean;
    sameSite?: "lax" | "strict" | "none";
    domain?: string;
    maxAge: number;
    expires: Date;  // <-- remove the ?
  };
  startedAt?: string;
  lastSeenAt?: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  [key: string]: unknown;
};