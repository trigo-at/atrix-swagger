'use strict';

const atrix = require('@trigo/atrix');
const path = require('path');
const supertest = require('supertest');

atrix.configure({ pluginMap: { swagger: path.join(__dirname, '../') } });

const svc = new atrix.Service('s1', {
	swagger: {
		serviceDefinition: path.join(__dirname, './pet-shop.yml'),
	},
	endpoints: {
		http: {
			port: 3007,
			handlerDir: `${__dirname}/handler`,
		},
	},
});
atrix.addService(svc);
svc.endpoints.add('http');

const svcs = {};

Object.keys(atrix.services).forEach((serviceName) => {
	const s = atrix.services[serviceName];
	if (s.config.config.endpoints.http) {
		svcs[s.name] = supertest(`http://localhost:${svc.config.config.endpoints.http.port}`);
	}
});

module.exports = {
	service: svc,
	start: async () => svc.start(),
	test: svcs[svc.name],
};
