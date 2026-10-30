"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { User, UserRole } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass, Modal, SuccessToast } from "@/components/ui";

type RowModal =
  | { type: "none" }
  | { type: "edit"; targetUser: User }
  | { type: "password"; targetUser: User }
  | { type: "delete"; targetUser: User };

// Spec 3.2: Administrator can manage users and application-level configuration.
export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: users, loading, error, reload } = useApi<User[]>(() => api.get("/users"), []);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<RowModal>({ type: "none" });

  useEffect(() => {
    if (user && user.role !== "ADMIN") router.replace("/dashboard");
  }, [user, router]);

  if (user && user.role !== "ADMIN") return null;

  function notify(message: string) {
    setModal({ type: "none" });
    reload();
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <AuthGate>
      <SuccessToast message={toast} />
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Administration — Users</h1>

      <ErrorBanner message={error} />

      <Card className="mb-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {users?.map((u) => (
              <UserRow
                key={u.id}
                targetUser={u}
                currentUserId={user?.id}
                onRoleSaved={() => notify("Role updated.")}
                onAction={(type) => setModal({ type, targetUser: u })}
              />
            ))}
          </tbody>
        </table>
      </Card>

      <CreateUserForm onCreated={() => notify("User created.")} />

      {modal.type === "edit" && (
        <EditUserModal targetUser={modal.targetUser} onClose={() => setModal({ type: "none" })} onSaved={() => notify("User updated.")} />
      )}
      {modal.type === "password" && (
        <ResetPasswordModal targetUser={modal.targetUser} onClose={() => setModal({ type: "none" })} onSaved={() => notify("Password reset.")} />
      )}
      {modal.type === "delete" && (
        <DeleteUserModal targetUser={modal.targetUser} onClose={() => setModal({ type: "none" })} onSaved={() => notify("User deleted.")} />
      )}
    </AuthGate>
  );
}

function UserRow({
  targetUser,
  currentUserId,
  onRoleSaved,
  onAction,
}: {
  targetUser: User;
  currentUserId: string | undefined;
  onRoleSaved: () => void;
  onAction: (type: "edit" | "password" | "delete") => void;
}) {
  const [role, setRole] = useState<UserRole>(targetUser.role);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSelf = targetUser.id === currentUserId;

  async function saveRole() {
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/users/${targetUser.id}/role`, { role });
      onRoleSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update role.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-gray-900">{targetUser.name}</td>
      <td className="px-4 py-3 text-gray-500">{targetUser.email}</td>
      <td className="px-4 py-3">
        <select
          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          <option value="STANDARD">Standard</option>
          <option value="ADMIN">Admin</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {role !== targetUser.role && (
            <Button className="!px-2 !py-0.5 text-xs" onClick={saveRole} disabled={submitting}>
              {submitting ? "Saving…" : "Save Role"}
            </Button>
          )}
          <button className="text-gray-600 hover:underline" onClick={() => onAction("edit")}>
            Edit
          </button>
          <button className="text-gray-600 hover:underline" onClick={() => onAction("password")}>
            Reset Password
          </button>
          {!isSelf && (
            <button className="text-red-500 hover:underline" onClick={() => onAction("delete")}>
              Delete
            </button>
          )}
          {error && <span className="text-red-600">{error}</span>}
        </div>
      </td>
    </tr>
  );
}

function EditUserModal({
  targetUser,
  onClose,
  onSaved,
}: {
  targetUser: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(targetUser.name);
  const [email, setEmail] = useState(targetUser.email);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.patch(`/users/${targetUser.id}`, { name, email });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError("Failed to save.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Edit User" onClose={onClose}>
      <ErrorBanner message={error} />
      <div className="space-y-4">
        <Field label="Name" error={fieldErrors.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" error={fieldErrors.email}>
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={submitting || !name || !email}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({
  targetUser,
  onClose,
  onSaved,
}: {
  targetUser: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.post(`/users/${targetUser.id}/password`, { password });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError("Failed to reset password.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title={`Reset Password — ${targetUser.name}`} onClose={onClose}>
      <ErrorBanner message={error} />
      <Field label="New Password" error={fieldErrors.password}>
        <input
          type="password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 10 characters, mixed case, a number, a symbol"
        />
      </Field>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={submitting || !password}>
          {submitting ? "Saving…" : "Reset Password"}
        </Button>
      </div>
    </Modal>
  );
}

function DeleteUserModal({
  targetUser,
  onClose,
  onSaved,
}: {
  targetUser: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      await api.delete(`/users/${targetUser.id}`);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete user.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Delete User" onClose={onClose}>
      <ErrorBanner message={error} />
      <p className="text-sm text-gray-600">
        Delete <strong>{targetUser.name}</strong> ({targetUser.email})? This cannot be undone.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={confirm} disabled={submitting}>
          {submitting ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("STANDARD");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function create() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.post("/users", { name, email, password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole("STANDARD");
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError("Failed to create user.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-xl p-6">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">Add User</h2>
      <ErrorBanner message={error} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" error={fieldErrors.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" error={fieldErrors.email}>
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" error={fieldErrors.password}>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 10 characters, mixed case, a number, a symbol"
          />
        </Field>
        <Field label="Role">
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="STANDARD">Standard</option>
            <option value="ADMIN">Admin</option>
          </select>
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={create} disabled={submitting || !name || !email || !password}>
          {submitting ? "Creating…" : "Create User"}
        </Button>
      </div>
    </Card>
  );
}
