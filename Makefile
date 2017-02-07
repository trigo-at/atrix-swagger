SHELL=/bin/bash
PACKAGE=$(shell cat package.json | jq ".name" | sed 's/@trigo\///')
REPO_VERSION:=$(shell cat package.json| jq .version)

install:
	yarn install

test:
	yarn test

test-watch:
	@nodemon --exec "make test || echo uuuppps..."

lint:
	yarn run lint

build: .
	docker-compose -f docker-compose.test.yml build

clean:
	rm -rf node_modules/

ci-test: build
	docker-compose -f docker-compose.test.yml run --rm $(PACKAGE); \
		test_exit=$$?; \
		docker-compose -f docker-compose.test.yml down; \
		exit $$test_exit

publish: build
	docker-compose -f docker-compose.test.yml run --rm $(PACKAGE) \
	   	/bin/bash -c 'if [ "$(REPO_VERSION)" != $$(npm show @trigo/$(PACKAGE) version) ]; then \
			npm publish; \
		else \
			echo "Version unchanged, no need to publish"; \
		fi'; EXIT_CODE=$$?; \
	docker-compose -f docker-compose.test.yml down; \
	exit $$EXIT_CODE

