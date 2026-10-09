
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

type CinemaAccount = {
  id: string;
  role: AccountRole;
  cinema_id: string;
};

function getAccountRole(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): AccountRole | null {
  const role =
    user.app_metadata?.role ?? user.user_metadata?.role;

  return role === "manager" || role === "food_court"
    ? role
    : null;
}

function getCinemaId(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string | null {
  const cinemaId =
    user.app_metadata?.cinema_id ??
    user.user_metadata?.cinema_id;

  return typeof cinemaId === "string" ? cinemaId : null;
}

export async function POST(request: Request) {
  try {
    if (!adminSupabase) {
      console.error("Supabase admin environment variables are missing.");

      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

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

    // 2. Verify Master Admin using the trusted database profile.
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

    // 3. Validate the request.
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

    // 4. Confirm the cinema exists.
    const { data: cinema, error: cinemaError } =
      await adminSupabase
        .from("cinemas")
        .select("id, name")
        .eq("id", cleanCinemaId)
        .maybeSingle();

    if (cinemaError || !cinema) {
      return NextResponse.json(
        { error: "Cinema not found." },
        { status: 404 }
      );
    }

    // 5. Load Auth users. Do not create a replacement until
    // we have checked both profiles and account metadata.
    const {
      data: usersData,
      error: usersError,
    } = await adminSupabase.auth.admin.listUsers({
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

    const authUsers = usersData.users;

    async function saveAccount(
      email: string,
      password: string,
      role: AccountRole
    ) {
      const cleanEmail = email.trim().toLowerCase();

      const fullName =
        role === "manager"
          ? `${cinema.name} Manager`
          : `${cinema.name} Food Court`;

      // Find existing profile records for this cinema and role.
      const {
        data: profiles,
        error: profilesError,
      } = await adminSupabase
        .from("profiles")
        .select("id, role, cinema_id")
        .eq("cinema_id", cinema.id)
        .eq("role", role)
        .limit(10);

      if (profilesError) {
        throw new Error(
          `Could not find the ${role} profile: ${profilesError.message}`
        );
      }

      // Prefer the existing profile's Auth user when available.
      const profileUsers = (profiles ?? [])
        .map((profile) =>
          authUsers.find((authUser) => authUser.id === profile.id)
        )
        .filter((authUser) => authUser !== undefined);

      const uniqueProfileUsers = Array.from(
        new Map(
          profileUsers.map((authUser) => [
            authUser.id,
            authUser,
          ])
        ).values()
      );

      // Also look for Auth accounts assigned to this cinema and role.
      // This recovers accounts whose profiles are missing.
      const metadataUsers = authUsers.filter(
        (authUser) =>
          getAccountRole(authUser) === role &&
          getCinemaId(authUser) === cinema.id
      );

      const candidateMap = new Map<
        string,
        (typeof authUsers)[number]
      >();

      for (const authUser of uniqueProfileUsers) {
        candidateMap.set(authUser.id, authUser);
      }

      for (const authUser of metadataUsers) {
        candidateMap.set(authUser.id, authUser);
      }

      // A duplicate or ambiguous assignment must not cause another
      // account to be created or a different account to be overwritten.
      if (candidateMap.size > 1) {
        throw new Error(
          `Multiple ${role} accounts are assigned to ${cinema.name}. ` +
            "No account was changed. Please resolve the duplicate accounts first."
        );
      }

      const existingUser = candidateMap.values().next().value;

      // Reject an email already owned by an unrelated account.
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
        // Update the SAME Auth user ID. This changes credentials without
        // replacing the account or changing its cinema assignment.
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
                cinema_id: cinema.id,
              },
              app_metadata: {
                ...existingUser.app_metadata,
                role,
                cinema_id: cinema.id,
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

        // Restore a missing profile or update the existing one.
        const { error: profileError } =
          await adminSupabase
            .from("profiles")
            .upsert(
              {
                id: existingUser.id,
                full_name: fullName,
                role,
                cinema_id: cinema.id,
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

      // No account is assigned to this cinema and role.
      // Create one only when no existing account can be reused.
      const { data: created, error: createError } =
        await adminSupabase.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: {
            role,
            cinema_id: cinema.id,
          },
          app_metadata: {
            role,
            cinema_id: cinema.id,
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

      const { error: profileInsertError } =
        await adminSupabase
          .from("profiles")
          .insert({
            id: newUserId,
            full_name: fullName,
            role,
            cinema_id: cinema.id,
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

    // 6. Save Manager, then Food Court.
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
        id: cinema.id,
        name: cinema.name,
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
