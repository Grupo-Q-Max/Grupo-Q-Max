import { AuthForm } from "@/components/crm/AuthForm";
import "../login/login.css";

/** /invite?token= — link of the CRM invitation e-mail: the invited user creates a password. */
export default function InvitePage() {
  return <AuthForm mode="invite" />;
}
