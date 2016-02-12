export PATH := ./node_modules/.bin/:$(PATH)
SHELL := /bin/bash

DIST=dist
JS=$(DIST)/flowplayer.hlsjs
TMP=/tmp/flowplayer.hlsjs.min.js

GIT_ID=${shell git rev-parse --short HEAD }

min: webpack
	@ sed -ne 's/\$$GIT_ID\$$/$(GIT_ID)/; /^\/\*!/,/^\*\// p' flowplayer.hlsjs.js | cat - $(DIST)/flowplayer.hlsjs.min.js > $(TMP) && mv $(TMP) $(DIST)/flowplayer.hlsjs.min.js

webpack:
	@ npm run build

all: min

debug: webpack
	@ sed -e 's/\$$GIT_ID\$$/$(GIT_ID)/' flowplayer.hlsjs.js > $(JS).js

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
