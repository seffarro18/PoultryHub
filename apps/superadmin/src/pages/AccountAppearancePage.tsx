import AppearanceSection from "@poultryhub/shared/components/profile/AppearanceSection";
import ProfilePageHeader from "../components/profile/ProfilePageHeader";

export default function AccountAppearancePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <ProfilePageHeader
        title="Appearance"
        subtitle="You already have a dark-green PoultryHub design either way — System Default just follows your device."
      />

      <AppearanceSection />
    </div>
  );
}
