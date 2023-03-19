export PATH := "./node_modules/.bin:" + env_var('PATH')

dev:
  next dev

build:
  next build && next export

wrangler:
  wrangler pages dev out/
