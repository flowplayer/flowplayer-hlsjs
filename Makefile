export PATH := ./node_modules/.bin/:$(PATH)
SHELL := /bin/bash

DIST=dist
JS=$(DIST)/flowplayer.hlsjs
LJS=$(JS).light

webpack:
	@ npm run build

light:
	@ npm run light

all: webpack

debug:
	$(eval GIT_DESC = $(shell git describe ))
	@ mkdir -p $(DIST)
	@ cp LICENSE.md $(DIST)/
	@ sed -e 's/\$$GIT_DESC\$$/$(GIT_DESC)/' flowplayer.hlsjs.js > $(JS).js
	@ sed -e 's/\$$GIT_DESC\$$/$(GIT_DESC)/' flowplayer.hlsjs.light.js > $(LJS).js
	@ cp node_modules/hls.js/dist/hls.min.js $(DIST)/
	@ cp node_modules/hls.js/dist/hls.light.min.js $(DIST)/

dist: clean all debug light

zip: dist
	@ cd $(DIST) && zip flowplayer.hlsjs.zip *.js LICENSE.md

clean:
	@ rm -rf $(DIST)

lint:
	@ npm run -s lint

deps:
	@ npm install
