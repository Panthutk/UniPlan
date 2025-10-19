import { Link, NavLink, useNavigate} from "react-router-dom";
import uniplanLogo from "./uniplanLogo.svg";

// Mock-up Universal Navbar
export function CustomeNavbar() {
  return (
    <header className="sticky top-0 flex items-center z-50 h-[clamp(34px,8.5vh,58px)] py-3 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
      <div className="container flex mx-auto max-w-[1600px] px-5 sm:px-6 lg:px-8 items-center justify-between">
        <img
          src={uniplanLogo}
          alt="Uniplan Logo"
          className="h-[clamp(30px,6vh,50px)] w-auto"
        />
        <nav className="flex items-center gap-3">
          <NavLink
            to="/"
            className=
            {
              ({ isActive }) =>
              `rounded-md border border-white/15 px-3 py-1.5 text-[clamp(12px,2vh,20px)] ${isActive ? "bg-white/10 text-white" : "text-zinc-200 hover:bg-white/5"}`
            }
          >
            Login
          </NavLink>

        </nav>
      </div>
    </header>
  );
}