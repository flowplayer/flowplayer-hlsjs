
DIST=dist
JS=$(DIST)/flowplayer.hlsjs.min.js

default:
	@ mkdir -p $(DIST)
	@ sed -ne '/^\/\*!/,/^\*\// p' flowplayer.hlsjs.js > $(JS)
	@ cat node_modules/hls.js/dist/hls.min.js >> $(JS)
	@ sed -e '/"use strict";/ d' flowplayer.hlsjs.js | uglifyjs --no-copyright >> $(JS)

all: default

dist: clean all
	@ cp node_modules/hls.js/dist/hls.js node_modules/hls.js/dist/hls.min.js flowplayer.hlsjs.js $(DIST)/

zip: clean dist
	@ cd $(DIST) && zip flowplayer.hlsjs.zip *.js

clean:
	@ rm -rf $(DIST)

deps:
	@ npm install
