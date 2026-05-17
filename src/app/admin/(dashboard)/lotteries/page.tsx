import { LotteryOpsPanel } from "@/components/admin/lottery-ops-panel";

export default function AdminLotteriesPage() {
  return (
    <div className="space-y-4">
      <a href="/admin" className="text-sm text-muted hover:text-foreground">
        ← Admin home
      </a>
      <div>
        <h1 className="text-2xl font-semibold">Lotteries (on-chain)</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Initialize the program once, then create draws on devnet. The connected
          wallet must be the on-chain authority (same wallet that ran initialize).
          Postgres admin login is separate from chain authority.
        </p>
      </div>
      <LotteryOpsPanel />
    </div>
  );
}
