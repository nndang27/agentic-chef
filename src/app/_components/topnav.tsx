"use client";

// import { Link, useLocation } from "wouter";
import { cn } from "../../lib/utils";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import {SimpleUploadButton} from "./simple-upload-button";

function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
        { href: "/", label: "Home" },
        { href: "/dashboardPage", label: "Dashboard" },
    ];

  const handleNavigate = () => {
      // Chuyển hướng sang trang /dashboard
      router.push('/dashboardPage'); 
    };

  return (
    // <nav className="p4 flex w-full items-center justify-between">
    //   <div>Gallery</div>

      // <div className="flex flex-row gap-4 item-center">
      //   <SignedOut>
      //     <SignInButton />
      //   </SignedOut>
      //   <SignedIn>
      //     <SimpleUploadButton />
      //     <UserButton />
      //   </SignedIn>
      // </div>
    // </nav>

        <nav className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
            <div className="container mx-auto px-4 flex h-16 items-center justify-between">
                <div className="flex items-center gap-8">
                    {/* <Link href="/" className="flex items-center space-x-2">
                        <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                            Receipt Demo
                        </span>
                    </Link> */}
                    <div 
                      onClick={handleNavigate} 
                      className="flex items-center space-x-2 cursor-pointer" // Thêm cursor-pointer để có hình bàn tay khi rê chuột
                    >
                            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                              Receipt Demo
                            </span>
                    </div>

                    {/* <div className="hidden md:flex gap-6">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-primary",
                                    location === item.href ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div> */}

                    <div className=" md:flex gap-6">
                      {navItems.map((item) => (
                          <div
                              key={item.href}
                              // 3. Xử lý click để chuyển trang
                              onClick={() => router.push(item.href)}
                              className={cn(
                                  // 4. Thêm cursor-pointer để người dùng biết bấm được
                                  "text-sm font-medium transition-colors hover:text-primary cursor-pointer",
                                  // 5. So sánh pathname với item.href để đổi màu
                                  pathname === item.href ? "text-primary" : "text-muted-foreground"
                              )}
                          >
                              {item.label}
                          </div>
                      ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <SignedOut>
                      <SignInButton />
                    </SignedOut>
                    <SignedIn>
                      <SimpleUploadButton />
                      <UserButton />
                    </SignedIn>
                  </div>
                
            </div>
        </nav>
  );
}

export default TopNav;
