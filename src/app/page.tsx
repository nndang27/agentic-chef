import Link from "next/link";
import { db } from "~/server/db";
import Image from "next/image";
import { getAllUsersRecipes } from "~/server/db/queries";

import { Hero } from "./_components/Hero";
import { RecipeFeed } from "./_components/RecipeFeedWidget";

export const dynamic = "force-dynamic";

const mockUrl = [
  "https://1feo6z23xl.ufs.sh/f/IXTWhUpeS2LunIwMVWqEpOakSwTIMiBLr8o9cYQGbH5ZDzlU",
  "https://1feo6z23xl.ufs.sh/f/IXTWhUpeS2LurNzRKLXRMPAlQBhiFzTgm9I1j40oWcxYfVwX",
];

const mockItem = mockUrl.map((url, index) => ({
  id: index + 1,
  url,
}));

export default async function HomePage() {
  const allRecipes = await getAllUsersRecipes();

  return (
    <main className="">
      {/* <div className="flex flex-wrap gap-4">
        {posts.map((item) => (
          <div key={item.id} className="h-48 w-48">
            <Link href={`/img/${item.id}`}>  
            <Image
              src={item.url}
              style={{ objectFit: "contain" }}
              width={480}
              height={480}
              alt={item.name}
            />
            </Link>
          </div>
        ))}
      </div> */}

        <div className="min-h-screen bg-slate-50/50">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100/40 via-transparent to-transparent opacity-60 pointer-events-none" />
          <Hero />
          <RecipeFeed recipes={allRecipes}/>
        </div>
    </main>
  );
}
