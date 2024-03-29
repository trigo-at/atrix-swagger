'use strict';

/* eslint-env node, mocha */
/* eslint no-unused-expressions: 0, arrow-body-style: 0 */

const { expect } = require('chai');
const { Atrix } = require('@trigo/atrix');
const path = require('path');
const Joi = require('joi');
const AtrixSwagger = require('./AtrixSwagger');

describe('AtrixSwagger', () => {
    describe('constructor', () => {
        it('ignores if "swagger" config missing', () => {
            const atrix = new Atrix();
            atrix.configure({ pluginMap: { swagger: path.join(__dirname, '../') } });
            const serivce = atrix.addService({ name: 'svc' });
            expect(() => new AtrixSwagger(atrix, serivce)).not.to.throw(Error);
        });

        it('checks if configure "swagger -> serivceDefinition" exist', () => {
            const atrix = new Atrix();
            atrix.configure({ pluginMap: { swagger: path.join(__dirname, '../') } });
            const serivce = atrix.addService({ name: 'svc', swagger: { serviceDefinition: 'gibts ned' } });
            expect(() => new AtrixSwagger(atrix, serivce)).to.throw(Error);
            expect(() => new AtrixSwagger(atrix, serivce)).to.throw('No serviceDefinition found at "gibts ned"');
        });
    });

    describe('loadServiceDefinition', () => {
        it('loads and parses the definition into property "serviceDefinition"', async () => {
            const atrix = new Atrix();
            atrix.configure({ pluginMap: { swagger: path.join(__dirname, '../') } });
            const serivce = atrix.addService({
                name: 'svc',
                swagger: { serviceDefinition: path.join(__dirname, '../specs/s1.yml') },
            });
            const as = new AtrixSwagger(atrix, serivce);
            await as.loadServiceDefinition();
            expect(as.serviceDefinition).to.exist;
        });
    });

    describe('setupServiceHandler', () => {
        it('does not modify handler config with minimal definition', async () => {
            const atrix = new Atrix();
            atrix.configure({ pluginMap: { swagger: path.join(__dirname, '../') } });
            const serivce = atrix.addService({
                name: 'svc',
                swagger: { serviceDefinition: path.join(__dirname, '../specs/s1.yml') },
            });
            const as = new AtrixSwagger(atrix, serivce);
            await as.loadServiceDefinition();
            const def = { method: 'GET', path: '/', options: { test: 'prop' } };
            const ret = await as.setupServiceHandler(def);
            expect(ret).to.eql(def);
        });

        describe('validations', () => {
            let as;
            before(async () => {
                const atrix = new Atrix();
                atrix.configure({ pluginMap: { swagger: path.join(__dirname, '../') } });
                const serivce = atrix.addService({
                    name: 'svc',
                    swagger: {
                        serviceDefinition: path.join(__dirname, '../specs/pet-shop.yml'),
                        responseValidationSample: 42,
                        responseValidationFailAction: 'log',
                    },
                });
                as = new AtrixSwagger(atrix, serivce);
                await as.loadServiceDefinition();
            });

            it('creates config -> validate -> params Joi schema', async () => {
                const cfg = await as.setupServiceHandler({ method: 'GET', path: '/pets/{petId}' });
                console.log(cfg.options.validate.params)
                expect(cfg.options.validate.params).to.exist;

                expect(Joi.isSchema(cfg.options.validate.params)).to.be.true;
            });

            it('creates config -> validate -> query Joi schema', async () => {
                const cfg = await as.setupServiceHandler({ method: 'GET', path: '/pets/findByTags' });
                expect(cfg.options.validate.query).to.exist;
                expect(Joi.isSchema(cfg.options.validate.query)).to.be.true;
            });

            it('creates config -> validate -> headers Joi schema', async () => {
                const cfg = await as.setupServiceHandler({ method: 'GET', path: '/supports-header-validation' });
                expect(cfg.options.validate.headers).to.exist;
                expect(Joi.isSchema(cfg.options.validate.headers)).to.be.true;
            });

            it('creates config -> validate -> payload Joi schema', async () => {
                const cfg = await as.setupServiceHandler({ method: 'POST', path: '/pets' });
                expect(cfg.options.validate.payload).to.exist;
                expect(Joi.isSchema(cfg.options.validate.payload)).to.be.true;
            });

            it('sets config -> validate -> params = undefined when no params parameters are declared', async () => {
                const cfg = await as.setupServiceHandler({ method: 'POST', path: '/pets' });
                expect(cfg.options.validate.params).to.be.undefined;
            });

            it('sets config -> validate -> query = false when no query parameterss are declared', async () => {
                const cfg = await as.setupServiceHandler({ method: 'POST', path: '/pets' });
                expect(cfg.options.validate.query).to.be.undefined;
            });

            it('sets config -> validate -> paylooad = false when no body parameters are declared', async () => {
                const cfg = await as.setupServiceHandler({ method: 'POST', path: '/pets' });
                expect(cfg.options.validate.query).to.be.undefined;
            });

            describe('response validation options', () => {
                it('sets config -> response -> status -> <statusCode> when defined', async () => {
                    const cfg = await as.setupServiceHandler({ method: 'GET', path: '/pets/findByStatus' });
                    expect(Joi.isSchema(cfg.options.response.status[200])).to.be.true;
                });

                it('sets config -> response -> sample to config.responseValidationSample value', async () => {
                    const cfg = await as.setupServiceHandler({ method: 'GET', path: '/pets/findByStatus' });
                    expect(cfg.options.response.sample).to.equal(42);
                });

                it('omits config -> response when no validaton schemas are provided', async () => {
                    const cfg = await as.setupServiceHandler({ method: 'POST', path: '/pets' });
                    expect(cfg.options.response).not.to.exist;
                });

                it('sets config -> response -> sample to config.responseValidationFailAction value', async () => {
                    const cfg = await as.setupServiceHandler({ method: 'GET', path: '/pets/findByStatus' });
                    expect(cfg.options.response.failAction).to.equal('log');
                });
            });
        });
    });
});
