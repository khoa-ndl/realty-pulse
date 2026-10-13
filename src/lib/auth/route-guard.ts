export function shouldRedirectTo(pathname: string, isAuthenticated: boolean): string | null {
  if (pathname.startsWith("/dashboard") && !isAuthenticated) return "/login";
  if (pathname === "/login" && isAuthenticated) return "/dashboard";
  return null;
}
