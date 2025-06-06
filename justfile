export PATH := "./node_modules/.bin:" + env_var('PATH')

dev:
  vite --host 0.0.0.0

build:
  rm -rf dist/
  mkdir dist/
  NODE_ENV=production node build.js
  cp index.html dist/
  cp -r public/* dist/
