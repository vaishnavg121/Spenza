import { UserProfile } from "@clerk/nextjs";
import { PageHeader } from "@/components/layout/page-header";
export default function ProfilePage() { return <div className="space-y-6"><PageHeader title="Profile" description="Manage your account details and session." /><UserProfile routing="hash" /></div>; }
