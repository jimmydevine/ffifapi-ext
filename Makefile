
VERSION = $(shell grep '"version"' manifest.json  | cut -d ':' -f 2 | tr -d '[", ]')

ffifapi-ext:
	zip -r bundles/ffifapi-ext-$(VERSION).zip manifest.json addon

