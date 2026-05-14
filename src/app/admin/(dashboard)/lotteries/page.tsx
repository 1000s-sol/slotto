export default function AdminLotteriesPage() {
  return (
    <div className="space-y-4">
      <a href="/admin" className="text-sm text-muted hover:text-foreground">
        ← Admin home
      </a>
      <h1 className="text-2xl font-semibold">Lotteries (admin)</h1>
      <p className="text-sm text-muted">
        Coming next: one active lottery at a time; blocked while a draw is running.
      </p>
    </div>
  );
}
