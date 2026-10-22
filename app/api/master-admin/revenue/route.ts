import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing server-side Supabase environment variables.");
  }
  return createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type OrderRow = {
  cinema_id: string | null;
  total: number | string | null;
  status: string | null;
  created_at: string;
};

export async function GET() {
  try {
    // Verify the request's real session before using the server-only admin client.
    const sessionClient = await createClient();
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const admin = getAdminSupabase();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    // The existing Master Admin login flow stores trusted roles in Supabase
    // app_metadata. Some older accounts may also have the role in profiles.
    // Never use user_metadata for authorization because users can edit it.
    const trustedRole = user.app_metadata?.role;
    if (profileError || (trustedRole !== "master_admin" && profile?.role !== "master_admin")) {
      console.warn("Master Admin revenue denied:", {
        userId: user.id,
        appRole: trustedRole ?? null,
        profileRole: profile?.role ?? null,
        profileLookupError: profileError?.message ?? null,
      });
      return NextResponse.json(
        { error: "Master Admin access required. Your account role is not recognized by the server. Please sign out and back in after verifying the Master Admin role." },
        { status: 403 }
      );
    }

    const [{ data: cinemas, error: cinemaError }, firstPage] = await Promise.all([
      admin.from("cinemas").select("id, name").order("name", { ascending: true }),
      admin.from("orders").select("cinema_id, total, status, created_at").order("created_at", { ascending: false }).range(0, 999),
    ]);

    if (cinemaError) throw new Error("Could not load cinemas: " + cinemaError.message);
    if (firstPage.error) throw new Error("Could not load orders: " + firstPage.error.message);

    const orders: OrderRow[] = [...((firstPage.data || []) as OrderRow[])];
    // Fetch in pages so totals aren't silently limited to Supabase's first 1,000 rows.
    for (let offset = 1000; (firstPage.data || []).length === 1000; offset += 1000) {
      const { data, error } = await admin
        .from("orders")
        .select("cinema_id, total, status, created_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + 999);
      if (error) throw new Error("Could not load all orders: " + error.message);
      orders.push(...((data || []) as OrderRow[]));
      if ((data || []).length < 1000) break;
    }

    const cinemaRows = (cinemas || []) as { id: string; name: string }[];
    const byCinema = new Map<string, { cinemaId: string; cinemaName: string; completedRevenue: number; completedOrders: number; allOrders: number; activeOrders: number }>();
    for (const cinema of cinemaRows) {
      byCinema.set(cinema.id, {
        cinemaId: cinema.id,
        cinemaName: cinema.name,
        completedRevenue: 0,
        completedOrders: 0,
        allOrders: 0,
        activeOrders: 0,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daily = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return { date: date.toISOString().slice(0, 10), revenue: 0, orders: 0 };
    });
    const dailyByDate = new Map(daily.map((item) => [item.date, item]));

    let completedRevenue = 0;
    let completedOrders = 0;
    let activeOrders = 0;

    for (const order of orders) {
      const status = String(order.status || "").toUpperCase();
      const row = order.cinema_id ? byCinema.get(order.cinema_id) : undefined;
      const amount = Number(order.total) || 0;
      if (row) {
        row.allOrders += 1;
        if (["NEW", "PREPARING", "READY"].includes(status)) row.activeOrders += 1;
      }
      if (status === "COMPLETED") {
        completedRevenue += amount;
        completedOrders += 1;
        if (row) {
          row.completedRevenue += amount;
          row.completedOrders += 1;
        }
        const dateKey = new Date(order.created_at).toISOString().slice(0, 10);
        const day = dailyByDate.get(dateKey);
        if (day) {
          day.revenue += amount;
          day.orders += 1;
        }
      }
      if (["NEW", "PREPARING", "READY"].includes(status)) activeOrders += 1;
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        completedRevenue,
        completedOrders,
        totalOrders: orders.length,
        activeOrders,
        cinemaCount: cinemaRows.length,
      },
      cinemas: [...byCinema.values()].sort((a, b) => b.completedRevenue - a.completedRevenue),
      daily,
      revenueDefinition: "Gross value of orders marked COMPLETED, grouped by order creation date. This is not net profit and excludes refunds/costs.",
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Master Admin revenue summary failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load revenue summary." },
      { status: 500 }
    );
  }
}
