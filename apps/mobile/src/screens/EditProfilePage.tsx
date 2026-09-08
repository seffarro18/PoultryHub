import { useAuth } from "@poultryhub/shared/context/AuthContext";
import PasswordSecuritySection from "@poultryhub/shared/components/profile/PasswordSecuritySection";
import AccountScreenHeader from "../components/AccountScreenHeader";
import FarmPersonalInfoSection from "../components/profile/FarmPersonalInfoSection";

/** Mobile's own full-screen replacement for Super Admin's Edit Profile modal — everything self-editable about a farm-side account (Personal Information, Password & Security), reached from the Profile settings menu's "My Account" row. */
export default function EditProfilePage() {
  const { user, refreshUser } = useAuth();

  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <AccountScreenHeader title="Edit Profile" />

      <FarmPersonalInfoSection user={user} onSaved={refreshUser} />
      <PasswordSecuritySection />
    </div>
  );
}
