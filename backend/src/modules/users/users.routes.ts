import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, signToken } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/authorize";
import { createUser, getUserByEmail, listUsers, updateUserRole } from "./users.service";
import { ValidationError } from "../../utils/errors";

export const usersRouter = Router();

/**
 * Development-only login stub. Authentication is intentionally isolated
 * from domain logic (spec 50) so this can be replaced by real SSO
 * (Entra ID / Google Workspace / Auth0) without touching any other module —
 * only this handler and `authenticate` would change.
 */
usersRouter.post(
  "/auth/dev-login",
  asyncHandler(async (req, res) => {
    const email = req.body?.email as string | undefined;
    if (!email) throw new ValidationError("Email is required.", { email: "Required" });

    const user = await getUserByEmail(email);
    if (!user) {
      throw new ValidationError("No user found with that email. Create one via POST /api/v1/users first.");
    }

    const token = signToken(user.id, user.role);
    res.json({ token, user });
  })
);

usersRouter.use(authenticate);

// Any authenticated user can list users (name/email/role only, no secrets) —
// Standard Users need this to pick a Study Owner (spec 11: "Owner" is a
// required Stage 1 field). Mutating users/roles below stays Administrator-only
// (spec 3.2: "Manage users").
usersRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    res.json(await listUsers());
  })
);

usersRouter.post(
  "/users",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { email, name, role } = req.body as { email: string; name: string; role?: UserRole };
    const user = await createUser({ email, name, role });
    res.status(201).json(user);
  })
);

usersRouter.patch(
  "/users/:id/role",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { role } = req.body as { role: UserRole };
    if (!Object.values(UserRole).includes(role)) {
      throw new ValidationError("Invalid role.", { role: "Must be STANDARD or ADMIN" });
    }
    res.json(await updateUserRole(req.params.id, role));
  })
);
