import {
  NextResponse,
} from "next/server";

export async function POST() {
  const response =
    NextResponse.json({
      success: true,
    });

  response.cookies.set(
    "finora_admin_session",
    "",
    {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      expires:
        new Date(0),
    },
  );

  return response;
}
