import { redirect } from "next/navigation";
import { getAuth } from "@/infra/auth";

export default async function HomePage() {
  const user = await (await getAuth()).getUser();
  redirect(user ? "/map" : "/login");
}
