import React from 'react';

const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-indigo-500/20 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/90 backdrop-blur-md shadow-lg shadow-indigo-950/40">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-3.5 sm:px-6">
        
        {/* Left: Rich Multi-Tone Logo & Title */}
        <a href="/" className="group flex items-center gap-2.5 focus:outline-none">
          
          {/* Animated Gradient Icon Box */}
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 p-[1px] shadow-md shadow-cyan-500/20 transition-transform duration-300 group-hover:scale-105">
            <div className="flex h-full w-full items-center justify-center rounded-[7px] bg-slate-950/90 backdrop-blur-sm transition-colors group-hover:bg-slate-900/80">
              <svg className="h-4 w-4 text-cyan-400 transition-colors group-hover:text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
          </div>

          {/* Glowing Multi-Color Text */}
          <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              JS3
            </span>
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(34,211,238,0.4)]">
              CODER
            </span>
          </h1>

        </a>

        {/* Right: Clean Space */}
        <div></div>

      </div>
    </header>
  );
};

export default Header;