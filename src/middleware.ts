import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
    const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
    const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard");

    if (!isAuthRoute && !isProtectedRoute) {
        return NextResponse.next();
    }

    const session = await auth.api.getSession({
        headers: request.headers
    });

    if (isAuthRoute && session) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (isProtectedRoute && !session) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/login"]
};