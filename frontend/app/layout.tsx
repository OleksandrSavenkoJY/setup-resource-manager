import "./globals.css";
import AuthBar from "@/components/AuthBar";
import HomeButton from "@/components/HomeButton";
import TopNav from "@/components/TopNav";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "Setup Resource Manager",
  description: "MVP for setup inventory and prompt generation",
};

// Runs before paint so the saved (or system) theme is applied without a flash.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <TopNav>
          <HomeButton />
          <ThemeToggle />
        </TopNav>
        <AuthBar />
        {children}
      </body>
    </html>
  );
}
