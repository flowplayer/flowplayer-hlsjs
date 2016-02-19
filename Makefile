export PATH := ./node_modules/.bin/:$(PATH)
SHELL := /bin/bash

DIST=dist
HLSJSDIST=node_modules/hls.js/dist
JS=$(DIST)/flowplayer.hlsjs

GIT_ID=$(shell git rev-parse --short HEAD )

min:
	@ mkdir -p $(DIST)
	@ sed -ne 's/\$$GIT_ID\$$/$(GIT_ID)/; /^\/\*!/,/^\*\// p' flowplayer.hlsjs.js > $(JS).min.js
	@ cat $(HLSJSDIST)/hls.min.js >> $(JS).min.js
	@ npm run -s min >> $(JS).min.js

all: min

debug:
	@ mkdir -p $(DIST)
	@ sed -e 's/\$$GIT_ID\$$/$(GIT_ID)/' flowplayer.hlsjs.js > $(JS).js
	@ cp $(HLSJSDIST)/hls.js $(DIST)/

dist: clean all debug
	@ cp LICENSE.md $(DIST)/

zip: clean dist
	@ cd $(DIST) && zip flowplayer.hlsjs.zip *.js LICENSE.md

clean:
	@ rm -rf $(DIST)

lint:
	@ npm run -s lint

deps:
	@ npm install
