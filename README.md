# nostr.com
### Instructions to Contribute
- make sure `node` and `npm` are installed

-  `node` version must be `18` or higher
```sh
$ node --version
$ v20.3.0
```


- clone this repo
```sh
$ cd /Users/user/my-projects
$ git clone https://github.com/lnbits/nostr.com.git
$ cd nostr.com
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

### Using `just` (optional)
- install `just` (see instructions [here](https://github.com/casey/just))
- see commands in the `just` file