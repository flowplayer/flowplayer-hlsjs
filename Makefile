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
	@ cp node_modules/hls.js/dist/hls.min.js $(DIST)/

release: clean debug
	@ cp LICENSE.md $(DIST)/
	@ sed -e 's/\$$GIT_ID\$$/$(GIT_ID)/' -ne '/^\/\*!/,/^\*\//p' flowplayer.hlsjs.js > $(JS).min.js
	@ cat headConditionalComment.js >> $(JS).min.js
	@ cat node_modules/hls.js/dist/hls.min.js >> $(JS).min.js
	@ npm run -s min >> $(JS).min.js
	@ sed -ne '/^\/\*@/,$$ p' footConditionalComment.js >> $(JS).min.js
	@ cp node_modules/hls.js/dist/hls.min.js $(DIST)/

zip: release
	@ cd $(DIST) && zip flowplayer.hlsjs.zip *.js LICENSE.md

clean:
	@ rm -rf $(DIST)

lint:
	@ npm run -s lint

deps:
	@ npm install
