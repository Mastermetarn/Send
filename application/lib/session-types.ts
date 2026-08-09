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
  oneTimeRead?: boolean;
  [key: string]: unknown;
};
