PACKAGE=$(shell cat package.json | jq ".name" | sed 's/@trigo\///')

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
	docker-compose -f docker-compose.test.yml run --rm $(PACKAGE) npm publish; \
		test_exit=$$?; \
		docker-compose -f docker-compose.test.yml down; \
		exit $$test_exit

