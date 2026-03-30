"use client";

import { useAuth } from "@/context/AuthContext";
import AuthSection from "@/components/AuthSection";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const { user } = useAuth();
  return user ? <Dashboard /> : <AuthSection />;
}
