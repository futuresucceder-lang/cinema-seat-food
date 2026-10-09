
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase server environment variables.");
}

const adminSupabase = createAdminClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type AccountRole = "manager" | "food_court";

type CinemaRecord = {
  id: string;
  name: string;
};

type AuthUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function getAccountRole(user: AuthUser): AccountRole | null {
  const role = user.app_metadata?.role ?? user.user_metadata?.role;

  return role === "manager" || role === "food_court" ? role : null;
}

function getCinemaId(user: AuthUser): string | null {
  const cinemaId =
    user.app_metadata?.cinema_id ?? user.user_metadata?.cinema_id;

  return typeof cinemaId === "string" ? cinemaId : null;
}

export async function POST(request: Request) {
  try {
    // 1. Verify the signed-in user.
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

    // 2. Verify Master Admin against the trusted database profile.
    const { data: masterProfile, error: masterProfileError } =
      await adminSupabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (
      masterProfileError ||
      masterProfile?.role !== "master_admin"
    ) {
      return NextResponse.json(
        { error: "Master Admin access required." },
        { status: 403 }
      );
    }

    // 3. Validate request data.
    const body = await request.json();

    const {
      cinemaId,
      managerEmail,
      managerPassword,
      foodCourtEmail,
      foodCourtPassword,
    } = body;

    if (
      typeof cinemaId !== "string" ||
      !cinemaId.trim()
    ) {
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
        {
          error:
            "Manager and Food Court email/password are required.",
        },
        { status: 400 }
      );
    }

    const cleanCinemaId = cinemaId.trim();
    const cleanManagerEmail = managerEmail.trim().toLowerCase();
    const cleanFoodCourtEmail = foodCourtEmail.trim().toLowerCase();

    if (cleanManagerEmail === cleanFoodCourtEmail) {
      return NextResponse.json(
        {
          error:
            "Manager and Food Court accounts must use different email addresses.",
        },
        { status: 400 }
      );
    }

    // 4. Find and validate the cinema.
    const { data: cinema, error: cinemaError } =
      await adminSupabase
        .from("cinemas")
        .select("id, name")
        .eq("id", cleanCinemaId)
        .maybeSingle();

    if (cinemaError) {
      return NextResponse.json(
        { error: "Could not load cinema: " + cinemaError.message },
        { status: 500 }
      );
    }

    if (!cinema) {
      return NextResponse.json(
        { error: "Cinema not found." },
        { status: 404 }
      );
    }

    const cinemaRecord: CinemaRecord = cinema;

    // 5. Load Auth users and check for existing accounts.
    const { data: usersData, error: usersError } =
      await adminSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (usersError) {
      return NextResponse.json(
        {
          error:
            "Could not read authentication users: " +
            usersError.message,
        },
        { status: 500 }
      );
    }

    const authUsers = usersData.users as AuthUser[];

    async function saveAccount(
      email: string,
      password: string,
      role: AccountRole
    ) {
      const cleanEmail = email.trim().toLowerCase();

      const fullName =
        role === "manager"
          ? `${cinemaRecord.name} Manager`
          : `${cinemaRecord.name} Food Court`;

      // Find profiles already assigned to this cinema and role.
      const { data: profiles, error: profilesError } =
        await adminSupabase
          .from("profiles")
          .select("id, role, cinema_id")
          .eq("cinema_id", cinemaRecord.id)
          .eq("role", role)
          .limit(10);

      if (profilesError) {
        throw new Error(
          `Could not find the ${role} profile: ${profilesError.message}`
        );
      }

      // Include Auth users found through profiles.
      const candidateMap = new Map<string, AuthUser>();

      for (const profile of profiles ?? []) {
        const profileUser = authUsers.find(
          (authUser) => authUser.id === profile.id
        );

        if (profileUser) {
          candidateMap.set(profileUser.id, profileUser);
        }
      }

      // Also recover accounts whose profile row is missing.
      for (const authUser of authUsers) {
        if (
          getAccountRole(authUser) === role &&
          getCinemaId(authUser) === cinemaRecord.id
        ) {
          candidateMap.set(authUser.id, authUser);
        }
      }

      // Do not guess which account to change if duplicates exist.
      if (candidateMap.size > 1) {
        throw new Error(
          `Multiple ${role} accounts are assigned to ${cinemaRecord.name}. ` +
            "No account was changed. Resolve the duplicate accounts first."
        );
      }

      const existingUser = candidateMap.values().next().value;

      // Never take over an email belonging to a different Auth user.
      const emailUser = authUsers.find(
        (authUser) =>
          authUser.email?.toLowerCase() === cleanEmail
      );

      if (emailUser && emailUser.id !== existingUser?.id) {
        throw new Error(
          `The email "${cleanEmail}" is already used by another account. ` +
            "Choose a different Login ID / Email."
        );
      }

      if (existingUser) {
        // Update the existing Auth user; preserve unrelated metadata.
        const { data: updated, error: updateError } =
          await adminSupabase.auth.admin.updateUserById(
            existingUser.id,
            {
              email: cleanEmail,
              password,
              email_confirm: true,
              user_metadata: {
                ...existingUser.user_metadata,
                role,
                cinema_id: cinemaRecord.id,
              },
              app_metadata: {
                ...existingUser.app_metadata,
                role,
                cinema_id: cinemaRecord.id,
              },
            }
          );

        if (updateError || !updated.user) {
          throw new Error(
            `Could not update ${role} account: ${
              updateError?.message ?? "Unknown Auth error"
            }`
          );
        }

        // Update or restore the matching profile.
        const { error: profileError } = await adminSupabase
          .from("profiles")
          .upsert(
            {
              id: existingUser.id,
              full_name: fullName,
              role,
              cinema_id: cinemaRecord.id,
            },
            { onConflict: "id" }
          );

        if (profileError) {
          throw new Error(
            `The ${role} Auth account was updated, but its profile could not be saved: ${profileError.message}`
          );
        }

        return {
          userId: existingUser.id,
          email: cleanEmail,
          action: "updated",
        };
      }

      // No existing account was found for this cinema and role.
      const { data: created, error: createError } =
        await adminSupabase.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: {
            role,
            cinema_id: cinemaRecord.id,
          },
          app_metadata: {
            role,
            cinema_id: cinemaRecord.id,
          },
        });

      if (createError || !created.user) {
        throw new Error(
          `Could not create ${role} account: ${
            createError?.message ?? "Unknown Auth error"
          }`
        );
      }

      const newUserId = created.user.id;

      const { error: profileInsertError } = await adminSupabase
        .from("profiles")
        .insert({
          id: newUserId,
          full_name: fullName,
          role,
          cinema_id: cinemaRecord.id,
        });

      if (profileInsertError) {
        await adminSupabase.auth.admin.deleteUser(newUserId);

        throw new Error(
          `Could not create ${role} profile: ${profileInsertError.message}`
        );
      }

      return {
        userId: newUserId,
        email: cleanEmail,
        action: "created",
      };
    }

    // 6. Save both accounts.
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
        id: cinemaRecord.id,
        name: cinemaRecord.name,
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
            : "Failed to create/update accounts.",
      },
      { status: 500 }
    );
  }
}
