import { Suspense } from "react";

import AdminLoginClient from "./AdminLoginClient";

function LoginFallback() {
  return (
    <main className="min-h-dvh bg-ink-950">
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <AdminLoginClient />
    </Suspense>
  );
}
