export async function register() {
  // Node-only code lives in its own file so it's left out of the edge bundle
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      await import("./instrumentation-node");
    } catch (error) {
      // A throwing hook makes Next.js fail every request, so never let it escape
      console.error("[instrumentation] failed to start:", error);
    }
  }
}
