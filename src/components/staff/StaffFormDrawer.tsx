import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { createStaffAccount, updateStaffProfile, type StaffInput, type StaffMember } from "../../services/staffService";

const EMPLOYMENT_STATUS_OPTIONS = ["Full-Time", "Part-Time", "Contract", "Probationary"];

interface StaffFormDrawerProps {
  /** null = create mode */
  staff: StaffMember | null;
  farmId: string;
  onClose: () => void;
  onSaved: () => void;
}

function textField(
  id: string,
  label: string,
  value: string,
  onChange: (next: string) => void,
  placeholder?: string
) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-foreground)]">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
      />
    </div>
  );
}

export default function StaffFormDrawer({ staff, farmId, onClose, onSaved }: StaffFormDrawerProps) {
  const isEdit = staff !== null;
  const [name, setName] = useState(staff?.name ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [employeeId, setEmployeeId] = useState(staff?.employeeId ?? "");
  const [contactNumber, setContactNumber] = useState(staff?.contactNumber ?? "");
  const [position, setPosition] = useState(staff?.position ?? "");
  const [employmentStatus, setEmploymentStatus] = useState(staff?.employmentStatus ?? "Full-Time");
  const [assignedHousePen, setAssignedHousePen] = useState(staff?.assignedHousePen ?? "");
  const [username, setUsername] = useState(staff?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!isEdit && !email.trim()) {
      setError("Email address is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const input: StaffInput = {
      employeeId: employeeId.trim() || null,
      contactNumber: contactNumber.trim() || null,
      position: position.trim() || null,
      employmentStatus: employmentStatus || null,
      assignedHousePen: assignedHousePen.trim() || null,
      username: username.trim() || null,
    };
    try {
      if (isEdit) {
        await updateStaffProfile(staff.id, name.trim(), input);
      } else {
        await createStaffAccount(name.trim(), email.trim(), farmId, input);
      }
      onSaved();
    } catch (err) {
      console.error("[StaffFormDrawer] save failed:", err);
      setError(
        isEdit
          ? "Couldn't save this staff member. Please try again."
          : "Couldn't create this account. The email may already be in use."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-foreground)]">
            {isEdit ? "Edit Staff" : "Add Staff"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-4">
            {error && (
              <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}
            {!isEdit && (
              <p className="text-xs text-[var(--color-muted)]">
                The account is activated immediately — the new hire gets an email to set their own password.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {textField("staff-name", "Full Name", name, setName, "e.g. Juan dela Cruz")}
              {isEdit ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--color-foreground)]">Email Address</label>
                  <input
                    value={email}
                    disabled
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-2 text-sm text-[var(--color-muted)] outline-none"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="staff-email" className="text-sm font-medium text-[var(--color-foreground)]">
                    Email Address
                  </label>
                  <input
                    id="staff-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@example.com"
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {textField("staff-employee-id", "Employee ID", employeeId, setEmployeeId)}
              {textField("staff-contact", "Contact Number", contactNumber, setContactNumber)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {textField("staff-position", "Position", position, setPosition, "e.g. Egg Collector")}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="staff-employment-status" className="text-sm font-medium text-[var(--color-foreground)]">
                  Employment Status
                </label>
                <select
                  id="staff-employment-status"
                  value={employmentStatus}
                  onChange={(e) => setEmploymentStatus(e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)]"
                >
                  {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {textField("staff-house-pen", "Assigned Poultry House/Pen", assignedHousePen, setAssignedHousePen, "Optional")}
              {textField("staff-username", "Username", username, setUsername, "Optional")}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {saving && <Loader2 size={14} className="spinner" />}
              {isEdit ? "Save changes" : "Add staff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
