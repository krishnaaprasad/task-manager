import { currentUser } from "@clerk/nextjs/server";

export default async function Dashboard() {
  const user = await currentUser();

  return (
    <div>
      <h1>Welcome {user.firstName}</h1>
      <p>Email: {user.emailAddresses[0].emailAddress}</p>
    </div>
  );
}
