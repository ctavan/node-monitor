PATH := $(CURDIR)/test/bin:$(PATH)
SHELL := $(shell which bash)

unit: check force
	run-tests -u $(ARGS)

test: check force
	run-tests -ui $(ARGS)

check: node_modules jshint gjslint force

node_modules:
	npm install

clean: force
	rm -rf node_modules etc/profile

jshint: force
	shopt -s globstar && \
	jshint {lib,test}/**/*.js --config test/share/jshint.conf

gjslint: force
	gjslint --debug_indentation --nojsdoc --unix_mode \
		-e test/fixtures \
		-r lib -r test -r bin

install: clean node_modules force

.PHONY: force
