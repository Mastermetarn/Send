export const APP_BASE_PATH = "/send";

export function withAppBasePath(pathname: string) {
  if (pathname === APP_BASE_PATH || pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname;
  }

  if (pathname.startsWith("/")) {
    return `${APP_BASE_PATH}${pathname}`;
  }

  return `${APP_BASE_PATH}/${pathname}`;
}

export function appApiPath(pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withAppBasePath(`/api${normalized}`);
}

export function appUrl(pathname: string) {
  const origin = process.env.AUTH_URL ?? "http://localhost:3000";
  return new URL(withAppBasePath(pathname), origin).toString();
}

export function stripAppBasePath(pathname: string) {
  if (pathname === APP_BASE_PATH) {
    return "/";
  }

  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length);
  }

  return pathname;
}