export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your expenses and balances.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Placeholder cards for balances */}
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total balance</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">$0.00</div>
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-emerald-500">You are owed</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-emerald-500">$0.00</div>
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-destructive">You owe</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-destructive">$0.00</div>
          </div>
        </div>
      </div>
    </div>
  );
}