import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, signToken } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/authorize";
import { createUser, listUsers, updateUserRole, verifyLogin } from "./users.service";
import { NotAuthenticatedError, ValidationError } from "../../utils/errors";

export const usersRouter = Router();

/**
 * Email/password login. Authentication is intentionally isolated from
 * domain logic (spec 50) so this can be replaced by real SSO
 * (Entra ID / Google Workspace / Auth0) without touching any other module —
 * only this handler and `authenticate` would change.
 */
usersRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      throw new ValidationError("Email and password are required.", {
        ...(email ? {} : { email: "Required" }),
        ...(password ? {} : { password: "Required" }),
      });
    }

    const user = await verifyLogin(email, password);
    if (!user) throw new NotAuthenticatedError("Invalid email or password.");

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
    const { email, name, password, role } = req.body as {
      email: string;
      name: string;
      password?: string;
      role?: UserRole;
    };
    const user = await createUser({ email, name, password, role });
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
