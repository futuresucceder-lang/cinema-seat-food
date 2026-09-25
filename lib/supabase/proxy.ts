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

  // Get the application role from Supabase app_metadata.
  const appMetadata =
    (claims?.app_metadata as Record<string, unknown> | undefined) ?? {};

  const userRole =
    typeof appMetadata.role === "string"
      ? appMetadata.role
      : null;

  const pathname = request.nextUrl.pathname;

  // Manager-only routes
  const isManagerRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/order-history") ||
    pathname.startsWith("/screens-seats") ||
    pathname.startsWith("/qr-generator");

  // Food Court is accessible by both managers and food court staff
  const isFoodCourtRoute = pathname.startsWith("/food-court");

  // Any protected staff route
  const isStaffRoute = isManagerRoute || isFoodCourtRoute;

  // Not logged in → send to manager login
  if (isStaffRoute && !claims) {
    const url = request.nextUrl.clone();

    url.pathname = "/manager-login";
    url.searchParams.set("redirect", pathname);

    return NextResponse.redirect(url);
  }

  // Manager-only page accessed by Food Court staff
  if (isManagerRoute && userRole !== "manager") {
    const url = request.nextUrl.clone();

    url.pathname = "/food-court";
    url.search = "";

    return NextResponse.redirect(url);
  }

  // Food Court page accessed by a logged-in user without a valid staff role
  if (
    isFoodCourtRoute &&
    userRole !== "manager" &&
    userRole !== "food_court"
  ) {
    const url = request.nextUrl.clone();

    url.pathname = "/manager-login";
    url.search = "";

    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}