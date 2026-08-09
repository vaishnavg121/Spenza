import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
export default clerkMiddleware(async (auth, request) => {
  if (isDashboardRoute(request)) await auth.protect();
}, {
  signInUrl: "/login",
  signUpUrl: "/signup",
});

export const config = {
    matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)", "/(api|trpc)(.*)"],
};
