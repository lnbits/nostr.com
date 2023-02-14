export function NostricaBanner() {
  return (
    <div className="static top-0 right-0 left-0 z-10 flex h-12 items-center justify-evenly bg-violet-500 p-2 px-8 text-slate-300">
      <a href="https://nostrica.com/" target="_blank">
        <img
          className="h-16"
          src="https://nostrica.com/images/nostrica-unconference.png"
        />
      </a>
      <p className="hidden font-bold text-cyan-300 lg:block">
        Unconference dedicated to bringing Nostriches together!
      </p>
      <p className="hidden sm:block">Uvita & Online</p>
      <p>March 19-21</p>
      <a
        href="https://nostrica.com/"
        target="_blank"
        className="block hidden font-bold text-white md:block"
      >
        nostrica.com
      </a>
    </div>
  )
}
