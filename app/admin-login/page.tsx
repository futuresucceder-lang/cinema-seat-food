import { redirect } from "next/navigation";

export default function AdminLoginPage() {
  // The Master Admin page contains the protected sign-in form.
  redirect("/master-admin");
}
