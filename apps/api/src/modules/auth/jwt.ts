import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  role: "customer" | "admin";
}

export function signAccessToken(payload: JwtPayload, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}
