import Image from "next/image";

const MAINTENANCE_IMAGE = "/maintenance/slotto-v2-coming-soon.png";

export function MaintenanceOverlay() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Slotto is under maintenance"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 p-4"
    >
      <div className="relative w-full max-w-3xl">
        <Image
          src={MAINTENANCE_IMAGE}
          alt="Slotto V2 is coming — working on improvements and upgrades"
          width={1200}
          height={900}
          priority
          className="h-auto w-full rounded-2xl shadow-2xl ring-1 ring-white/10"
          sizes="(max-width: 768px) 100vw, 768px"
        />
      </div>
    </div>
  );
}
