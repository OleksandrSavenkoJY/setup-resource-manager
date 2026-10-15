import "./globals.css";

export const metadata = {
  title: "Setup Resource Manager",
  description: "MVP for setup inventory and prompt generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
