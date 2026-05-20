import { ProfileMyTicketsSection } from "@/components/profile/profile-my-tickets-section";
import { ProfileSocialSection } from "@/components/profile/profile-social-section";
import { ProfileWalletsSection } from "@/components/solana/profile-wallets-section";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileSocialSection />

        <ProfileWalletsSection />
      </div>

      <ProfileMyTicketsSection />
    </div>
  );
}
