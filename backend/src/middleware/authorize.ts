import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { NotAuthenticatedError, NotAuthorizedError } from "../utils/errors";

/**
 * Spec 51: every API request must validate that the authenticated user is
 * permitted to perform the action server-side. Client-side hiding of
 * buttons is not sufficient. Call this after `authenticate`.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new NotAuthenticatedError();
    if (!roles.includes(req.user.role)) {
      throw new NotAuthorizedError();
    }
    next();
  };
}

export const requireAdmin = requireRole(UserRole.ADMIN);
