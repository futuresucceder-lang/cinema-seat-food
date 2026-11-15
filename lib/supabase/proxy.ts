import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet, _headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  const pathname = request.nextUrl.pathname;

  const managerRoutes =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/order-history") ||
    pathname.startsWith("/screens-seats") ||
    pathname.startsWith("/qr-generator");

  // Do not protect the public Food Court login page itself.
  const foodCourtRoute =
    pathname.startsWith("/food-court/") &&
    !pathname.startsWith("/food-court-login");

  // Any protected page requires login.
  if ((managerRoutes || foodCourtRoute) && !claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/manager-login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  const role =
    (claims?.app_metadata as { role?: string } | undefined)?.role;

  // Manager-only pages.
  if (managerRoutes && role !== "manager") {
    const url = request.nextUrl.clone();
    url.pathname = "/food-court";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Food Court-only page.
  if (foodCourtRoute && role !== "food_court") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}