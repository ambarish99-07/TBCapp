import rateLimit from "express-rate-limit";

export const loginRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

export const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

// Same shape as loginRateLimiter — a real SMS provider would also bill per
// message, so this cap matters even more once OTPs are real.
export const otpRequestRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// Separate from loginRateLimiter: verifying an OTP legitimately takes more
// attempts than a password login (the two-phase new-user flow resubmits the
// same code with a name, resends reset the OtpCode's own attempt counter,
// etc.) — a shared, tighter limiter would false-positive on normal usage.
export const otpVerifyRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
