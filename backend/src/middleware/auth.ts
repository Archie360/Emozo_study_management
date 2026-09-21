import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../config/env";
import { NotAuthenticatedError } from "../utils/errors";

export interface AuthUser {
  id: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Spec 50: application must require authenticated users. This is a minimal
 * JWT bearer-token implementation, deliberately isolated from domain logic
 * so it can be swapped for Entra ID / Google Workspace / Auth0 later.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    throw new NotAuthenticatedError();
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string; role: UserRole };
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw new NotAuthenticatedError("Invalid or expired session.");
  }
}

export function signToken(userId: string, role: UserRole): string {
  return jwt.sign({ sub: userId, role }, env.jwtSecret, { expiresIn: "12h" });
}
