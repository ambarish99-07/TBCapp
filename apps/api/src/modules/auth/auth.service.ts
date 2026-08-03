import bcrypt from "bcrypt";

const BCRYPT_COST = 10;

// Precomputed once so a "user not found" login attempt still pays the same bcrypt
// cost as a real comparison would — this is what keeps login timing independent
// of whether the email exists, so responses can't be used to enumerate valid emails.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-constant-time-compare", BCRYPT_COST);

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_COST);
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

/** Call this on the "user not found" path so login takes the same time either way. */
export async function verifyAgainstDummyHash(plainPassword: string): Promise<false> {
  await bcrypt.compare(plainPassword, DUMMY_HASH);
  return false;
}
