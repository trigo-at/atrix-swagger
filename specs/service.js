'use strict';

const atrix = require('@trigo/atrix');
const path = require('path');
const supertest = require('supertest');

atrix.configure({pluginMap: {swagger: path.join(__dirname, '../')}});

const svc = atrix.addService({
    name: 'svc1',
    logger: {
        level: 'debug',
    },
    swagger: {
        serviceDefinition: path.join(__dirname, './pet-shop.yml'),
    },
    endpoints: {
        http: {
            port: 3007,
            handlerDir: `${__dirname}/handler`,
            prefix: '/prefix',
        },
    },
    security: {
        strategies: {
            jwt: {
                secret: 'changeme',
            },
        },
        endpoints: {
            jwt: ['/swagger.json'],
        },
    },
});

const svcs = {};

Object.keys(atrix.services).forEach(serviceName => {
    const s = atrix.services[serviceName];
    if (s.config.config.endpoints.http) {
        svcs[s.name] = supertest(`http://localhost:${svc.config.config.endpoints.http.port}`);
    }
});

module.exports = {
    start: async () => {
        await svc.start();
    },
    stop: async () => {
        await svc.stop();
    },
    test: svcs[svc.name],
};
