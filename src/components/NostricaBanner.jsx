export function NostricaBanner() {
  return (
    <div className="static top-0 right-0 left-0 z-10 flex h-12 items-center space-x-2 bg-violet-500 p-2 px-8 text-slate-300 lg:justify-evenly">
      <a
        href="https://nostrica.com/"
        target="_blank"
        className="block font-bold text-slate-100"
      >
        nostrica.com
      </a>
      <p>Unconference dedicated to bringing Nostriches together!</p>
      <p>Uvita & Online</p>
      <p>March 19-21</p>
      <a href="https://nostrica.com/" target="_blank" className="block">
        <img
          className="h-16"
          src="https://nostrica.com/images/nostrica-unconference.png"
        />
      </a>
    </div>
  )
}
