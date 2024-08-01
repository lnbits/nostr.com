import { useState } from 'react'

const URL = 'https://my.nostr.com/'

export function Nip05SearchBar({ query = '' }) {
    const [searchQuery, setSearchQuery] = useState(query)

    const handleChange = (e) => {
        const query = e.target.value
        setSearchQuery(query)
    }

    const handleSearch = () => {
        if (searchQuery) {
            return window.open(`${URL}?q=${searchQuery}`, '_blank', 'noopener', 'noreferrer')
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            return handleSearch()
        }
    }
  return (
      <div class="flex flex-col">
        <div class="relative">
          <div class="z-0 relative ">
            <div className="relative flex z-50 rounded-full bg-slate-800 hover:bg-slate-700 w-full sm:min-w-[340px] overflow-x-hidden">
              <input type="text" value={searchQuery ?? ''} placeholder="Get a nostr.com identifier" class="rounded-full block flex-auto px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 focus:outline-none" onChange={handleChange} onKeyDown={handleKeyDown} />
              <button className="absolute right-0 rounded-full bg-sky-300 py-2 px-4 text-sm font-semibold text-slate-900 hover:bg-sky-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/50 active:bg-sky-500'" onClick={handleSearch}>Search</button>
            </div>
            <div className="absolute w-full text-xs font-light text-neutral-500 mt-0.5 pl-3">
              Powered by LNbits
            </div>
          </div>
        </div>
      </div>
  )
}
