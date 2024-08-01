import { useState } from 'react'

const URL = `https://my.nostr.com?q=`

export function Nip05SearchBar({ query = '' }) {
    const [searchQuery, setSearchQuery] = useState(query)

    const handleChange = (e) => {
        const query = e.target.value
        setSearchQuery(query)
    }

    const handleSearch = () => {
        if (searchQuery.trim() !== '') {
            return window.open(URL + searchQuery.trim(), '_blank', 'noopener', 'noreferrer')
        }
    }

    return (
      <form
          onSubmit={handleSearch}
          className="flex items-center rounded-full bg-slate-700 p-1"
          title="get your NIP05 name!"
        >
          <input
            type="text"
            placeholder="@nostr.com"
            value={searchQuery}
            onChange={handleChange}
                className="flex-auto w-3/4 bg-transparent text-white placeholder-slate-400 focus:outline-none sm:w-32"
                style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
          />
          <button
            type="submit"
            className="ml-2 rounded-full bg-sky-300 hover:bg-sky-200 px-3 py-1 text-sm text-slate-900"
          >
            Search
          </button>
        </form>
  )
}
