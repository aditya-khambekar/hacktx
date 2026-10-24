export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-3.5">
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e8d7cf]">
        <span className="font-brand -mt-2 text-[1.7rem] leading-none font-black text-[#1f352e]">
          u
        </span>
        <span
          className="absolute bottom-[14%] left-1/2 h-1 w-[46%] -translate-x-1/2 bg-[#ac5c3f]"
          aria-hidden="true"
        />
      </span>
      <span className="font-brand text-[1.75rem] leading-none font-black text-[#1f352e]">
        un
        <span className="relative inline-block">
          listed
          <span
            className="absolute inset-x-0 bottom-[0.12em] h-[0.12em] bg-[#ac5c3f]"
            aria-hidden="true"
          />
        </span>
      </span>
    </span>
  )
}
