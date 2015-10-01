
DIST=dist
JS=$(DIST)/flowplayer.hlsjs.min.js

default:
	@ mkdir -p $(DIST)
	@ sed -ne '1,/^\*\// p' flowplayer.hlsjs.js > $(JS)
	@ echo '' >> $(JS)
	@ cat hls.min.js >> $(JS)
	@ echo '' >> $(JS)
	@ uglifyjs --no-copyright flowplayer.hlsjs.js >> $(JS)

all: default

dist: clean all
	@ cp hls.js hls.min.js flowplayer.hlsjs.js $(DIST)/

zip: clean dist
	@ cd $(DIST) && zip flowplayer.hlsjs.zip *.js

clean:
	@ rm -rf $(DIST)
