import { useAuth } from "@poultryhub/shared/context/AuthContext";
import PersonalInfoSection from "@poultryhub/shared/components/profile/PersonalInfoSection";
import PasswordSecuritySection from "@poultryhub/shared/components/profile/PasswordSecuritySection";
import ProfilePageHeader from "../components/profile/ProfilePageHeader";

export default function EditProfilePage() {
  const { user, refreshUser } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <ProfilePageHeader title="My Account" />

      <PersonalInfoSection user={user} onSaved={refreshUser} />
      <PasswordSecuritySection />
    </div>
  );
}
