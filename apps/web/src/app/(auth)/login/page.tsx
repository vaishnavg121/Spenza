"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("login");
  const [error, setError] = useState("");
  const router = useRouter();

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isSubmitting: isLoggingIn },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const {
    register: registerSignup,
    handleSubmit: handleSignupSubmit,
    formState: { errors: signupErrors, isSubmitting: isSigningUp },
  } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });

  const onLogin = async (data: z.infer<typeof loginSchema>) => {
    setError("");
    const { error } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
    });
    if (error) {
      setError(error.message || "Invalid credentials");
    } else {
      router.push("/dashboard");
    }
  };

  const onSignup = async (data: z.infer<typeof registerSchema>) => {
    setError("");
    const { error } = await authClient.signUp.email({
      name: data.name,
      email: data.email,
      password: data.password,
    });
    if (error) {
      setError(error.message || "Failed to create account");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="px-5 pt-6 text-center sm:px-7 sm:pt-8">
        <CardTitle className="text-2xl">Welcome to Spenza</CardTitle>
        <CardDescription className="text-center">
          Sign in or create an account to manage your shared expenses.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-6 sm:px-7 sm:pb-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" type="email" autoComplete="email" {...registerLogin("email")} />
                {loginErrors.email && (
                  <p className="text-sm text-destructive">{loginErrors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input id="login-password" type="password" autoComplete="current-password" {...registerLogin("password")} />
                {loginErrors.password && (
                  <p className="text-sm text-destructive">{loginErrors.password.message}</p>
                )}
              </div>
              {error && activeTab === "login" && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? "Logging in..." : "Login"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleSignupSubmit(onSignup)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-name">Name</Label>
                <Input id="register-name" autoComplete="name" {...registerSignup("name")} />
                {signupErrors.name && (
                  <p className="text-sm text-destructive">{signupErrors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input id="register-email" type="email" autoComplete="email" {...registerSignup("email")} />
                {signupErrors.email && (
                  <p className="text-sm text-destructive">{signupErrors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input id="register-password" type="password" autoComplete="new-password" {...registerSignup("password")} />
                {signupErrors.password && (
                  <p className="text-sm text-destructive">{signupErrors.password.message}</p>
                )}
              </div>
              {error && activeTab === "register" && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={isSigningUp}>
                {isSigningUp ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
