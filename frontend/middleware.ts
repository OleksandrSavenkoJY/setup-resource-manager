import { NextResponse } from "next/server";

// Pages are open to everyone (guest mode); the backend enforces admin-only actions.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
