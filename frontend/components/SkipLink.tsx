"use client";

export default function SkipLink() {
  return (
    <a
      href="#main"
      className="skip-link"
      onClick={(e) => {
        e.preventDefault();
        const main = document.querySelector("main");
        if (main) {
          main.setAttribute("tabindex", "-1");
          (main as HTMLElement).focus();
        }
      }}
    >
      Skip to content
    </a>
  );
}
