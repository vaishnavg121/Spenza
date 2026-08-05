import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function GroupDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: true,
        },
      },
      expenses: {
        include: {
          creator: true,
          splits: true,
        },
        orderBy: {
          date: "desc",
        },
      },
    },
  });

  if (!group) {
    notFound();
  }

  const isMember = group.members.some((m) => m.userId === session.user.id);
  if (!isMember) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 rounded-xl border">
            {group.imageUrl ? (
              <AvatarImage src={group.imageUrl} alt={group.name} />
            ) : (
              <AvatarFallback className="rounded-xl bg-primary/10 text-xl text-primary">
                {group.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
            <p className="text-muted-foreground">{group.description || "No description provided"}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0">
          <TabsTrigger
            value="expenses"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Expenses
          </TabsTrigger>
          <TabsTrigger
            value="balances"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Balances
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Members
          </TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="pt-6">
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 p-8 text-center">
            <h3 className="text-lg font-semibold">No expenses yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Add your first expense to start tracking splits.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="balances" className="pt-6">
           <div className="text-muted-foreground text-sm">Balances logic coming next.</div>
        </TabsContent>
        <TabsContent value="members" className="pt-6 space-y-4">
           {group.members.map(member => (
              <div key={member.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                 <div className="flex items-center gap-4">
                    <Avatar>
                       <AvatarImage src={member.user.image || ""} />
                       <AvatarFallback>{member.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                       <p className="font-medium leading-none">{member.user.name} {member.userId === session.user.id && "(You)"}</p>
                       <p className="text-sm text-muted-foreground">{member.user.email}</p>
                    </div>
                 </div>
                 <div className="text-sm font-medium">
                    {member.role}
                 </div>
              </div>
           ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}