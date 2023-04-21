'use strict';

const pkg = require('../package.json');
const AtrixSwagger = require('./AtrixSwagger');

module.exports = {
    name: pkg.name,
    version: pkg.version,
    register: () => { },
    factory: (atrix, service) => new AtrixSwagger(atrix, service),
    compatibility: {
        atrix: {
            min: '7.0.0-alpha3',
        },
    },
};
