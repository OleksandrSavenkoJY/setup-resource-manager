import "./globals.css";
import NavBar from "@/components/NavBar";
import SkipLink from "@/components/SkipLink";
import UiProvider from "@/components/UiProvider";

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
        <UiProvider>
          <SkipLink />
          <NavBar />
          {children}
        </UiProvider>
      </body>
    </html>
  );
}
