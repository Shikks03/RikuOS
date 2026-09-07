import { redirect } from "next/navigation";

/**
 * The landing page is the Freelance overview (R42): the numbers Riku wants
 * first thing in the morning. The approvals queue is one tap away on the view
 * switch, and a push notification opens it directly.
 */
export default function Home() {
  redirect("/freelance");
}
