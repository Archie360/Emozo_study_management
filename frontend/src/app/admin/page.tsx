"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { User, UserRole } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, inputClass, SuccessToast } from "@/components/ui";

// Spec 3.2: Administrator can manage users and application-level configuration.
export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: users, loading, error, reload } = useApi<User[]>(() => api.get("/users"), []);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "ADMIN") router.replace("/dashboard");
  }, [user, router]);

  if (user && user.role !== "ADMIN") return null;

  function notify(message: string) {
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
              <RoleRow key={u.id} targetUser={u} onSaved={() => notify("Role updated.")} />
            ))}
          </tbody>
        </table>
      </Card>

      <CreateUserForm onCreated={() => notify("User created.")} />
    </AuthGate>
  );
}

function RoleRow({ targetUser, onSaved }: { targetUser: User; onSaved: () => void }) {
  const [role, setRole] = useState<UserRole>(targetUser.role);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/users/${targetUser.id}/role`, { role });
      onSaved();
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
        {role !== targetUser.role && (
          <Button className="!px-2 !py-0.5 text-xs" onClick={save} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        )}
        {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
      </td>
    </tr>
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
            placeholder="At least 8 characters"
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
