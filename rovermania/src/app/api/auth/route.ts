import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: Request) {
    try {
        const { password } = await req.json();

        if (password === "PrerithRover") {
            const response = NextResponse.json({ success: true }, { status: 200 });
            response.cookies.set({
                name: "rover_auth",
                value: "authenticated",
                httpOnly: true,
                path: "/",
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 60 * 24 * 7 // 1 week
            });
            return response;
        }

        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }
}
