"use client";

/**
 * The app's only sign-out control, moved here from /queue's deleted inline
 * header. Styled by `.app-side .btn.ghost` at --ink-3 rather than --ink-4 —
 * it must be legible.
 *
 * The navigation is in a `finally` because this is the only way out: a
 * rejected fetch must not leave the click doing nothing at all.
 */
export default function LogoutButton() {
  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <button type="button" className="btn ghost" onClick={() => void logout()}>
      Log out
    </button>
  );
}
