export PATH := "./node_modules/.bin:" + env_var('PATH')

dev:
  vite --host 0.0.0.0

build:
  vite build

deploy: build
  netlify deploy dist/ --prod
