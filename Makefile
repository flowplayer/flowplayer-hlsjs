export PATH := ./node_modules/.bin/:$(PATH)
SHELL := /bin/bash

DIST=dist
JS=$(DIST)/flowplayer.hlsjs

webpack:
	@ npm run build

all: webpack

debug:
	$(eval GIT_ID = $(shell git rev-parse --short HEAD ))
	@ mkdir -p $(DIST)
	@ cp node_modules/hls.js/dist/hls.js $(DIST)/
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
