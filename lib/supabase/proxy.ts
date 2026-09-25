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

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value, options);
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

  const isManagerRoute =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/food-court") ||
    request.nextUrl.pathname.startsWith("/order-history") ||
    request.nextUrl.pathname.startsWith("/screens-seats") ||
    request.nextUrl.pathname.startsWith("/qr-generator");

  if (isManagerRoute && !claims) {
    const url = request.nextUrl.clone();

    url.pathname = "/manager-login";
    url.searchParams.set(
      "redirect",
      request.nextUrl.pathname
    );

    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}