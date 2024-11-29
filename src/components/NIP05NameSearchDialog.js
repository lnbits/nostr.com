import {useState} from 'react'

const URL = `https://my.nostr.com?q=`

export function NIP05NameSearchDialog({query = ''}) {
  const [searchQuery, setSearchQuery] = useState(query)

  const handleChange = e => {
    const query = e.target.value
    setSearchQuery(query)
  }

  const handleSearch = e => {
    e.preventDefault() // Prevent the form from submitting normally

    // Get the content of the element with id "npub"
    const npubElement = document.getElementById('npub')
    const npubValue = npubElement ? npubElement.textContent.trim() : ''

    if (searchQuery.trim() !== '') {
      const finalURL = `${URL}${searchQuery.trim()}${
        npubValue ? `&npub=${encodeURIComponent(npubValue)}` : ''
      }`
      window.open(finalURL, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <form
      onSubmit={handleSearch}
      className="rounded-full bg-slate-700 p-1 md:flex-row lg:flex"
      title="get your NIP05 name!"
    >
      <input
        type="text"
        placeholder="Pick a name"
        value={searchQuery}
        onChange={handleChange}
        className="h-10 w-1/2 flex-auto bg-transparent text-white placeholder-slate-400 focus:outline-none sm:w-32"
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '1.2rem'
        }}
      />
      <button
        type="submit"
        className="ml-2 h-10 w-32 rounded-full bg-sky-300 px-3 py-1 text-sm text-slate-900 hover:bg-sky-200"
        style={{
          fontSize: '1rem'
        }}
      >
        Let’s Go!
      </button>
    </form>
  )
}
