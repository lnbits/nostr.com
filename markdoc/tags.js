import {Callout} from '@/components/Callout'
import {QuickLink, QuickLinks} from '@/components/QuickLinks'

const tags = {
  callout: {
    attributes: {
      title: {type: String},
      type: {
        type: String,
        default: 'note',
        matches: ['note', 'warning'],
        errorLevel: 'critical'
      }
    },
    render: Callout
  },
  figure: {
    selfClosing: true,
    attributes: {
      src: {type: String},
      alt: {type: String},
      caption: {type: String}
    },
    render: ({src, alt = '', caption}) => (
      <figure>
        <img src={src} alt={alt} />
        <figcaption>{caption}</figcaption>
      </figure>
    )
  },
  video: {
    selfClosing: true,
    attributes: {
      src: {type: String, required: true},
      youtube: {type: String},
      poster: {type: String}
    },
    render: ({src, youtube, poster}) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          margin: '20px auto'
        }}
      >
        <video
          id="video"
          preload="auto"
          controls
          src={src}
          poster={poster}
          style={{marginBottom: '0'}}
        ></video>
        {youtube && youtube.length > 0 && (
          <small style={{textAlign: 'right'}}>
            <a href={youtube} target="_blank">
              Watch this on YouTube
            </a>
          </small>
        )}
      </div>
    )
  },
  youtube: {
    selfClosing: true,
    attributes: {
      id: {type: String, required: true},
      width: {type: Number},
      height: {type: Number}
    },
    render: ({id, width = 560, height = 315}) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          margin: '20px auto'
        }}
      >
        <iframe
          width={width}
          height={height}
          src={`https://www.youtube.com/embed/${id}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        ></iframe>
      </div>
    )
  },
  'quick-links': {
    render: QuickLinks
  },
  'quick-link': {
    selfClosing: true,
    render: QuickLink,
    attributes: {
      title: {type: String},
      description: {type: String},
      icon: {type: String},
      href: {type: String}
    }
  }
}

export default tags
