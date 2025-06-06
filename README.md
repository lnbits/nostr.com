## development

it's better if you install [`just`](https://just.systems/), but you can also read the contents of the `justfile` and run the scripts there.

and also run `npm install --force` because of some stupid dependency conflicts.

then just run `just` and it will run the site in dev mode with `vite`.

## deploying

this site uses a github action to build the static assets and push them to cloudflare pages, it does not use the default cloudflare pipeline.

the commands to build the actual app do not use `vite` at all, they use `esbuild` directly (because `vite` wasn't working with the account generation _solidjs_ app imported dynamically as needed).

to build just do:

```
just build
```

that will empty and create a `dist/` directory with everything that is needed. you can serve the site from it later using whatever method you want, like `python -m http.server 5000` and whatnot.
