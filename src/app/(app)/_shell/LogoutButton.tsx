"use client";

/**
 * The app's only sign-out control, moved here from /queue's deleted inline
 * header. Styled by `.app-side .btn.ghost` at --ink-3 rather than --ink-4 —
 * it must be legible.
 */
export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button type="button" className="btn ghost" onClick={() => void logout()}>
      Log out
    </button>
  );
}
