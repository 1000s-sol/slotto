import { LotteryManageSection } from "@/components/admin/lottery-manage-section";
import {
  lotteryCluster,
  lotteryClusterLabel,
} from "@/lib/lottery/cluster";

export default function AdminLotteriesPage() {
  const clusterLabel = lotteryClusterLabel(lotteryCluster());

  return (
    <div className="space-y-4">
      <a href="/admin" className="text-sm text-muted hover:text-foreground">
        ← Admin home
      </a>
      <div>
        <h1 className="text-2xl font-semibold">Lotteries (on-chain)</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Initialize the program once, then create draws on {clusterLabel}. The
          connected wallet must be the on-chain authority (same wallet that ran
          initialize). Postgres admin login is separate from chain authority.
        </p>
      </div>
      <LotteryManageSection />
    </div>
  );
}
