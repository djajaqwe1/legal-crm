import { redirect } from "next/navigation";
import { readPortalPayload } from "@/lib/portal-session-server";
import { PortalLoginForm } from "@/components/portal/portal-login-form";

export default async function PortalLoginPage() {
  const p = await readPortalPayload();
  if (p) {
    redirect("/portal/dashboard");
  }
  return <PortalLoginForm />;
}
