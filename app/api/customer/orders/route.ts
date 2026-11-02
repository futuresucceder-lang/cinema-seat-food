import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RequestedItem = { id: string; quantity: number };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emojiFor(category: string | null) {
  const value = (category || "").toLowerCase();
  if (["drink", "drinks", "beverage", "beverages"].includes(value)) return "🥤";
  if (["meal", "meals", "food"].includes(value)) return "🍔";
  return "🍿";
}

// Public access is limited to high-entropy order codes created by this endpoint.
// Never return the full orders table or accept a partial order-code search.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const singleCode = url.searchParams.get("code");
  const codesParam = url.searchParams.get("codes");
  const codes = singleCode ? [singleCode] : (codesParam || "").split(",").filter(Boolean);

  if (!codes.length || codes.length > 20 || codes.some((code) => !uuidPattern.test(code))) {
    return NextResponse.json({ error: "Invalid or missing order access code." }, { status: 400 });
  }

  const { data, error } = await adminSupabase
    .from("orders")
    .select("order_code,movie,cinema_id,screen,seat,food_items,total,status,created_at,delivery_option")
    .in("order_code", codes);

  if (error) {
    console.error("Customer order lookup failed:", error);
    return NextResponse.json({ error: "Could not load order." }, { status: 500 });
  }

  const rows = data || [];
  if (singleCode && rows.length !== 1) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({ orders: rows }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cinemaId = String(body.cinemaId || "");
    const screen = String(body.screen || "").trim();
    const seat = String(body.seat || "").trim();
    const deliveryOption = body.deliveryOption === "INTERVAL" ? "INTERVAL" : "NOW";
    const requestedItems = body.items as RequestedItem[];

    if (!uuidPattern.test(cinemaId) || !screen || !seat ||
        !Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 20) {
      return NextResponse.json({ error: "Invalid order details. Please scan your seat QR code again." }, { status: 400 });
    }

    const cleanItems = new Map<string, number>();
    for (const item of requestedItems) {
      if (!item || !uuidPattern.test(String(item.id)) ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
        return NextResponse.json({ error: "Invalid food item or quantity." }, { status: 400 });
      }
      cleanItems.set(item.id, (cleanItems.get(item.id) || 0) + item.quantity);
    }

    const [{ data: screenRow, error: screenError }, { data: cinema, error: cinemaError }] = await Promise.all([
      adminSupabase.from("screens").select("id").eq("cinema_id", cinemaId).eq("name", screen).maybeSingle(),
      adminSupabase.from("cinemas").select("id").eq("id", cinemaId).maybeSingle(),
    ]);

    if (cinemaError || screenError) throw new Error("Could not validate cinema and screen.");
    if (!cinema || !screenRow) return NextResponse.json({ error: "Cinema or screen not found." }, { status: 400 });

    const { data: seatRow, error: seatError } = await adminSupabase
      .from("seats").select("id,is_active")
      .eq("screen_id", screenRow.id).eq("seat_number", seat).maybeSingle();

    if (seatError) throw new Error("Could not validate seat.");
    if (!seatRow || seatRow.is_active === false) {
      return NextResponse.json({ error: "This seat is not active. Please contact cinema staff." }, { status: 400 });
    }

    const itemIds = [...cleanItems.keys()];
    const { data: menuItems, error: menuError } = await adminSupabase
      .from("food_items")
      .select("id,name,price,category,is_available")
      .eq("cinema_id", cinemaId).in("id", itemIds);

    if (menuError) throw new Error("Could not validate menu items.");
    if (!menuItems || menuItems.length !== itemIds.length || menuItems.some((item) => item.is_available !== true)) {
      return NextResponse.json({ error: "One or more selected items are no longer available." }, { status: 400 });
    }

    const foodItems = menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      emoji: emojiFor(item.category),
      quantity: cleanItems.get(item.id) || 0,
    }));
    const total = foodItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderCode = crypto.randomUUID();

    const { data: order, error: insertError } = await adminSupabase
      .from("orders")
      .insert({
        order_code: orderCode,
        movie: null,
        cinema_id: cinemaId,
        screen,
        seat,
        food_items: foodItems,
        total,
        status: "NEW",
        delivery_option: deliveryOption,
      })
      .select("order_code,status,screen,seat,created_at,delivery_option,total")
      .single();

    if (insertError) {
      console.error("Customer order insert failed:", insertError);
      if (insertError.message.toLowerCase().includes("ordering is closed")) {
        return NextResponse.json({ error: "Online ordering is closed for this show. Please contact cinema staff." }, { status: 409 });
      }
      return NextResponse.json({ error: "Your order could not be submitted. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ order }, {
      status: 201,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Customer checkout failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not place order." }, { status: 500 });
  }
}
