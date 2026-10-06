import { useAuth } from "@poultryhub/shared/context/AuthContext";
import NotificationPreferencesSection from "@poultryhub/shared/components/profile/NotificationPreferencesSection";
import ProfilePageHeader from "../components/profile/ProfilePageHeader";

export default function AccountNotificationsPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <ProfilePageHeader title="Notifications" subtitle="Choose which alerts you want to receive." />

      <NotificationPreferencesSection role={user.role} />
    </div>
  );
}
