export async function register() {
  // Node-only code lives in its own file so it's left out of the edge bundle
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
