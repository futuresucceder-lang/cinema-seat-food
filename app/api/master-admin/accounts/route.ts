```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminSupabase =
  supabaseUrl && serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

type AccountRole = "manager" | "food_court";

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

function getRole(user: AuthUser): AccountRole | null {
  const role = user.app_metadata?.role ?? user.user_metadata?.role;

  return role === "manager" || role === "food_court"
    ? role
    : null;
}

function getCinemaId(user: AuthUser): string | null {
  const id =
    user.app_metadata?.cinema_id ?? user.user_metadata?.cinema_id;

  return typeof id === "string" ? id : null;
}

export async function POST(request: Request) {
  try {
    if (!adminSupabase) {
      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const { data: masterProfile, error: masterError } =
      await adminSupabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (masterError || masterProfile?.role !== "master_admin") {
      return NextResponse.json(
        { error: "Master Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      cinemaId,
      managerEmail,
      managerPassword,
      foodCourtEmail,
      foodCourtPassword,
    } = body;

    if (typeof cinemaId !== "string" || !cinemaId.trim()) {
      return NextResponse.json(
        { error: "Cinema ID is required." },
        { status: 400 }
      );
    }

    if (
      typeof managerEmail !== "string" ||
      !managerEmail.trim() ||
      typeof managerPassword !== "string" ||
      !managerPassword ||
      typeof foodCourtEmail !== "string" ||
      !foodCourtEmail.trim() ||
      typeof foodCourtPassword !== "string" ||
      !foodCourtPassword
    ) {
      return NextResponse.json(
        { error: "Enter both account email addresses and passwords." },
        { status: 400 }
      );
    }

    const cleanManagerEmail = managerEmail.trim().toLowerCase();
    const cleanFoodCourtEmail = foodCourtEmail.trim().toLowerCase();

    if (cleanManagerEmail === cleanFoodCourtEmail) {
      return NextResponse.json(
        { error: "Manager and Food Court must use different email addresses." },
        { status: 400 }
      );
    }

    const { data: cinema, error: cinemaError } =
      await adminSupabase
        .from("cinemas")
        .select("id, name")
        .eq("id", cinemaId.trim())
        .maybeSingle();

    if (cinemaError) {
      console.error("Cinema lookup failed:", cinemaError.message);
      return NextResponse.json(
        { error: "Could not look up the selected cinema." },
        { status: 500 }
      );
    }

    if (!cinema) {
      return NextResponse.json(
        { error: "Cinema not found." },
        { status: 404 }
      );
    }

    // Capture validated, non-null values for the account functions.
    const selectedCinemaId: string = cinema.id;
    const selectedCinemaName: string = cinema.name;

    const authUsers: AuthUser[] = [];
    const perPage = 1000;
    let page = 1;

    // Read all pages so an existing account isn't missed.
    while (true) {
      const { data, error } =
        await adminSupabase.auth.admin.listUsers({
          page,
          perPage,
        });

      if (error) {
        return NextResponse.json(
          { error: `Could not read authentication users: ${error.message}` },
          { status: 500 }
        );
      }

      authUsers.push(...(data.users as AuthUser[]));

      if (data.users.length < perPage) break;
      page++;
    }

    async function saveAccount(
      email: string,
      password: string,
      role: AccountRole
    ) {
      const cleanEmail = email.trim().toLowerCase();
      const fullName =
        role === "manager"
          ? `${selectedCinemaName} Manager`
          : `${selectedCinemaName} Food Court`;

      const { data: profiles, error: profilesError } =
        await adminSupabase!
          .from("profiles")
          .select("id, role, cinema_id")
          .eq("cinema_id", selectedCinemaId)
          .eq("role", role)
          .limit(20);

      if (profilesError) {
        throw new Error(
          `Could not find the ${role} profile: ${profilesError.message}`
        );
      }

      const candidates = new Map<string, AuthUser>();

      for (const profile of profiles ?? []) {
        const matchingUser = authUsers.find(
          (authUser) => authUser.id === profile.id
        );
        if (matchingUser) candidates.set(matchingUser.id, matchingUser);
      }

      for (const authUser of authUsers) {
        if (
          getRole(authUser) === role &&
          getCinemaId(authUser) === selectedCinemaId
        ) {
          candidates.set(authUser.id, authUser);
        }
      }

      if (candidates.size > 1) {
        throw new Error(
          `Multiple ${role} accounts are assigned to ${selectedCinemaName}. ` +
          "No account was changed. Resolve the duplicate accounts before trying again."
        );
      }

      const existingUser = candidates.values().next().value as
        | AuthUser
        | undefined;

      const emailUser = authUsers.find(
        (authUser) => authUser.email?.toLowerCase() === cleanEmail
      );

      if (emailUser && emailUser.id !== existingUser?.id) {
        throw new Error(
          `The email "${cleanEmail}" is already used by another account. ` +
          "Choose a different Login ID / Email."
        );
      }

      if (existingUser) {
        const { data: updated, error: updateError } =
          await adminSupabase!.auth.admin.updateUserById(
            existingUser.id,
            {
              email: cleanEmail,
              password,
              email_confirm: true,
              user_metadata: {
                ...existingUser.user_metadata,
                role,
                cinema_id: selectedCinemaId,
              },
              app_metadata: {
                ...existingUser.app_metadata,
                role,
                cinema_id: selectedCinemaId,
              },
            }
          );

        if (updateError || !updated.user) {
          throw new Error(
            `Could not update ${role} account: ${
              updateError?.message ?? "Unknown authentication error"
            }`
          );
        }

        const { error: profileError } = await adminSupabase!
          .from("profiles")
          .upsert(
            {
              id: existingUser.id,
              full_name: fullName,
              role,
              cinema_id: selectedCinemaId,
            },
            { onConflict: "id" }
          );

        if (profileError) {
          throw new Error(
            `${role} Auth account was updated, but its profile could not be saved: ${profileError.message}`
          );
        }

        return {
          userId: existingUser.id,
          email: cleanEmail,
          action: "updated",
        };
      }

      const { data: created, error: createError } =
        await adminSupabase!.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: {
            role,
            cinema_id: selectedCinemaId,
          },
          app_metadata: {
            role,
            cinema_id: selectedCinemaId,
          },
        });

      if (createError || !created.user) {
        throw new Error(
          `Could not create ${role} account: ${
            createError?.message ?? "Unknown authentication error"
          }`
        );
      }

      const newUserId = created.user.id;

      const { error: profileInsertError } = await adminSupabase!
        .from("profiles")
        .insert({
          id: newUserId,
          full_name: fullName,
          role,
          cinema_id: selectedCinemaId,
        });

      if (profileInsertError) {
        await adminSupabase!.auth.admin.deleteUser(newUserId);
        throw new Error(
          `Could not create ${role} profile: ${profileInsertError.message}`
        );
      }

      authUsers.push({
        id: newUserId,
        email: cleanEmail,
        user_metadata: {
          role,
          cinema_id: selectedCinemaId,
        },
        app_metadata: {
          role,
          cinema_id: selectedCinemaId,
        },
      });

      return {
        userId: newUserId,
        email: cleanEmail,
        action: "created",
      };
    }

    const manager = await saveAccount(
      cleanManagerEmail,
      managerPassword,
      "manager"
    );

    const foodCourt = await saveAccount(
      cleanFoodCourtEmail,
      foodCourtPassword,
      "food_court"
    );

    return NextResponse.json({
      success: true,
      cinema: {
        id: selectedCinemaId,
        name: selectedCinemaName,
      },
      manager,
      foodCourt,
    });
  } catch (error) {
    console.error("Master Admin account error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create or update accounts.",
      },
      { status: 500 }
    );
  }
}
```
