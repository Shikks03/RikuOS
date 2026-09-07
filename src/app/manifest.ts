import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    // Identity, pinned (R45). A manifest without `id` is identified by its
    // start_url, so moving start_url — as R42 did, from the queue to the
    // Freelance overview — silently changed which app an installed copy
    // belongs to. "/" is the origin, so start_url can move again without
    // that happening twice. It does not reach a copy already installed under
    // the old identity; that one is removed and added again by hand.
    id: "/",
    start_url: "/freelance",
    display: "standalone",
    // --void. Left at #ffffff the installed app flashes white on every
    // launch, which is the most visible possible bug in a dark-only design.
    background_color: "#08090B",
    theme_color: "#08090B",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
