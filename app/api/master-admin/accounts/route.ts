import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables. Check Vercel Environment Variables."
    );
  }

  return createAdminClient(supabaseUrl, serviceRoleKey);
}
type AccountRole = "manager" | "food_court";

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Check logged-in user
    // --------------------------------------------------

    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. Verify Master Admin
    // --------------------------------------------------

    const { data: masterProfile, error: masterProfileError } =
      await adminSupabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (
      masterProfileError ||
      masterProfile?.role !== "master_admin"
    ) {
      return NextResponse.json(
        { error: "Master Admin access required." },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 3. Read request
    // --------------------------------------------------

    const body = await request.json();

    const {
      cinemaId,
      managerEmail,
      managerPassword,
      foodCourtEmail,
      foodCourtPassword,
    } = body;

    if (!cinemaId) {
      return NextResponse.json(
        { error: "Cinema ID is required." },
        { status: 400 }
      );
    }

    if (
      !managerEmail?.trim() ||
      !managerPassword ||
      !foodCourtEmail?.trim() ||
      !foodCourtPassword
    ) {
      return NextResponse.json(
        {
          error:
            "Manager and food court email/password are required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 4. Find cinema
    // --------------------------------------------------

    const { data: cinema, error: cinemaError } =
      await adminSupabase
        .from("cinemas")
        .select("id, name")
        .eq("id", cinemaId)
        .single();

    if (cinemaError || !cinema) {
      return NextResponse.json(
        { error: "Cinema not found." },
        { status: 404 }
      );
    }

    // IMPORTANT:
    // Store the confirmed cinema in a new constant.
    // This prevents TypeScript from treating it as possibly null
    // inside the nested saveAccount() function.
    const cinemaRecord = cinema;

    // --------------------------------------------------
    // 5. Load Auth users
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 6. Create or update one cinema account
    // --------------------------------------------------

    async function saveAccount(
      email: string,
      password: string,
      role: AccountRole
    ) {
      const cleanEmail = email.trim().toLowerCase();

      // Find profile belonging to this cinema + role.
      const {
        data: existingProfile,
        error: existingProfileError,
      } = await adminSupabase
        .from("profiles")
        .select("id, role, cinema_id")
        .eq("cinema_id", cinemaRecord.id)
        .eq("role", role)
        .maybeSingle();

      if (existingProfileError) {
        throw new Error(existingProfileError.message);
      }

      // Find requested email in Auth.
      const emailUser = authUsers.find(
        (authUser) =>
          authUser.email?.toLowerCase() === cleanEmail
      );

      // ==================================================
      // EXISTING CINEMA ACCOUNT
      // ==================================================

      if (existingProfile) {
        const accountUserId = existingProfile.id;

        // If requested email belongs to a DIFFERENT user,
        // don't overwrite that user's account.
        if (
          emailUser &&
          emailUser.id !== accountUserId
        ) {
          throw new Error(
            `The email "${cleanEmail}" is already used by another account. Please choose a different Login ID / Email.`
          );
        }

        // Update existing Auth account.
        const {
          data: updatedUser,
          error: updateError,
        } =
          await adminSupabase.auth.admin.updateUserById(
            accountUserId,
            {
              password,
              email: cleanEmail,
              email_confirm: true,

              user_metadata: {
                role,
                cinema_id: cinemaRecord.id,
              },

              app_metadata: {
                role,
                cinema_id: cinemaRecord.id,
              },
            }
          );

        if (updateError || !updatedUser.user) {
          throw new Error(
            `Could not update ${role} account: ${
              updateError?.message || "Unknown Auth error"
            }`
          );
        }

        // Make absolutely sure profile remains attached
        // to the correct cinema.
        const { error: profileUpdateError } =
          await adminSupabase
            .from("profiles")
            .update({
              full_name:
                role === "manager"
                  ? `${cinemaRecord.name} Manager`
                  : `${cinemaRecord.name} Food Court`,
              role,
              cinema_id: cinemaRecord.id,
            })
            .eq("id", accountUserId);

        if (profileUpdateError) {
          throw new Error(
            `Could not update ${role} profile: ${profileUpdateError.message}`
          );
        }

        return {
          userId: accountUserId,
          email: cleanEmail,
          action: "updated",
        };
      }

      // ==================================================
      // NO EXISTING CINEMA ACCOUNT
      // ==================================================

      let userId: string;

      // If email already belongs to somebody else,
      // don't take over that account.
      if (emailUser) {
        throw new Error(
          `The email "${cleanEmail}" is already used by another account. Please choose a different Login ID / Email.`
        );
      }

      // Create new Auth user.
      const {
        data: createdUser,
        error: createUserError,
      } =
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

      if (createUserError || !createdUser.user) {
        throw new Error(
          `Could not create ${role} account: ${
            createUserError?.message ||
            "Unknown Auth error"
          }`
        );
      }

      userId = createdUser.user.id;

      // Create profile.
      const { error: profileInsertError } =
        await adminSupabase
          .from("profiles")
          .insert({
            id: userId,
            full_name:
              role === "manager"
                ? `${cinemaRecord.name} Manager`
                : `${cinemaRecord.name} Food Court`,
            role,
            cinema_id: cinemaRecord.id,
          });

      if (profileInsertError) {
        // If profile creation fails, remove the Auth user
        // so we don't leave an incomplete account behind.
        await adminSupabase.auth.admin.deleteUser(userId);

        throw new Error(
          `Could not create ${role} profile: ${profileInsertError.message}`
        );
      }

      return {
        userId,
        email: cleanEmail,
        action: "created",
      };
    }

    // --------------------------------------------------
    // 7. Save Manager
    // --------------------------------------------------

    const manager = await saveAccount(
      managerEmail,
      managerPassword,
      "manager"
    );

    // --------------------------------------------------
    // 8. Save Food Court
    // --------------------------------------------------

    const foodCourt = await saveAccount(
      foodCourtEmail,
      foodCourtPassword,
      "food_court"
    );

    // --------------------------------------------------
    // 9. Success
    // --------------------------------------------------

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
    console.error(
      "Master Admin account error:",
      error
    );

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
