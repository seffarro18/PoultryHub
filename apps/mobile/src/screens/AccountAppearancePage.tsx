import AppearanceSection from "@poultryhub/shared/components/profile/AppearanceSection";
import AccountScreenHeader from "../components/AccountScreenHeader";

export default function AccountAppearancePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <AccountScreenHeader
        title="Appearance"
        subtitle="You already have a dark-green PoultryHub design either way — System Default just follows your device."
      />

      <AppearanceSection />
    </div>
  );
}
