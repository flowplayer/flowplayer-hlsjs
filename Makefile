
DIST=dist
JS=$(DIST)/flowplayer.hlsjs

GIT_ID=${shell git rev-parse --short HEAD }

min:
	@ mkdir -p $(DIST)
	@ sed -ne 's/\$$GIT_ID\$$/$(GIT_ID)/; /^\/\*!/,/^\*\// p' flowplayer.hlsjs.js > $(JS).min.js
	@ cat node_modules/hls.js/dist/hls.min.js >> $(JS).min.js
	@ sed -e '/"use strict";/ d' flowplayer.hlsjs.js | npm run -s minify >> $(JS).min.js 2>/dev/null

all: min

debug:
	@ mkdir -p $(DIST)
	@ cp node_modules/hls.js/dist/hls.js $(DIST)/
	@ sed -e 's/\$$GIT_ID\$$/$(GIT_ID)/' flowplayer.hlsjs.js > $(JS).js

dist: clean all debug
	@ cp node_modules/hls.js/dist/hls.min.js LICENSE.md $(DIST)/

zip: clean dist
	@ cd $(DIST) && zip flowplayer.hlsjs.zip *.js LICENSE.md

clean:
	@ rm -rf $(DIST)

lint:
	@ npm run -s lint

deps:
	@ npm install && npm run prepare
