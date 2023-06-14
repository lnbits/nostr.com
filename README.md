# nostr.com
### Instructions for Ben
* Clone
* Install `just` https://github.com/casey/just#packages
* `cd /nostr.com`
* `just dev`

First make sure `nvm` and `npm` are installed

### Instructions to Contribute

- clone this repo
```sh
$ cd /Users/user/my-projects
$ git clone https://github.com/lnbits/nostr.com.git
```

- make sure the `node` version is `18` or higher
```sh
$ node --version
$ v20.3.0
```

- install dependencies
```sh
$ npm install
```

- start application in dev mode (should be available at http://localhost:3000)
```sh
$ npm run dev

> dev
> next

ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

- build and export the application for production use (the files are written to the `out` directory)
```sh
$ npm run build
```

