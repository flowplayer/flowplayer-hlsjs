
DIST=dist
JS=$(DIST)/flowplayer.hlsjs.min.js

default:
	@ mkdir -p $(DIST)
	@ sed -ne '/^\/\*!/,/^\*\// p' flowplayer.hlsjs.js > $(JS)
	@ echo '' >> $(JS)
	@ cat hls.min.js >> $(JS)
	@ echo '' >> $(JS)
	@ sed -e '/"use strict";/ d' flowplayer.hlsjs.js | uglifyjs --no-copyright >> $(JS)

all: default

dist: clean all
	@ cp hls.js hls.min.js flowplayer.hlsjs.js $(DIST)/

zip: clean dist
	@ cd $(DIST) && zip flowplayer.hlsjs.zip *.js

clean:
	@ rm -rf $(DIST)
