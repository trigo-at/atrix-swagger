'use strict';

const SwaggerParser = require('swagger-parser');
const fs = require('fs');
const BaseJoi = require('joi');
const DateExtension = require('joi-date-extensions');
const R = require('ramda');
const { createParameterValidator, createResponseValidator } = require('./create-validator');

const Joi = BaseJoi.extend(DateExtension);

const getParams = R.filter(R.propEq('in', 'path')); // eslint-disable-line
const getQuery = R.filter(R.propEq('in', 'query')); // eslint-disable-line
const getBody = R.filter(R.propEq('in', 'body')); // eslint-disable-line

class AtrixSwagger {
	constructor(atrix, service) {
		this.atrix = atrix;
		this.service = service;
		this.config = service.config.config;
		this.log = this.service.log.child({ plugin: 'AtrixSwagger' });


		if (!this.config.swagger) {
			this.log.warn(`No "swagger" section found config of service "${this.service.name}"`);
			return;
		}

		if (!fs.existsSync(this.config.swagger.serviceDefinition)) {
			throw new Error(`No serviceDefinition found at "${this.config.swagger.serviceDefinition}"`);
		}

		const httpEndpoint = this.service.endpoints.get('http');
		if (!httpEndpoint) {
			this.log.warn('No HttpEndpoind registered');
			return;
		}
		httpEndpoint.instance.registerRouteProcessor(this);
	}

	async init() {
		await this.loadServiceDefinition();
	}

	async process(handlers) {
		// const retHandlers = handlers;
		for (const handler of handlers) { //eslint-disable-line
			const route = await this.setupServiceHandler(handler); //eslint-disable-line
			handler.method = route.method;
			handler.path = route.path;
			handler.config = route.config;
		}

		this.log.debug('register /swagger.json route');
		const swaggerJson = {
			method: 'GET',
			path: '/swagger.json',
			handler: (req, reply) => {
				reply(this.serviceDefinition);
			},
			config: {
				cors: true,
			},
		};

		handlers.push(swaggerJson);
		return handlers;
	}

	async loadServiceDefinition() {
		const parser = new SwaggerParser();
		this.serviceDefinition = await parser.dereference(this.config.swagger.serviceDefinition);
	}

	async setupServiceHandler({ method, path, config }) {
		this.log.debug(`setup handler for "${method} ${path}"`);

		const handlerDefinition = this.getHandlerDefinition(path);
		if (!handlerDefinition || !handlerDefinition[method.toLowerCase()]) {
			this.log.warn(`No Swagger specification found for route: ${method} ${path}`);
			return {
				method,
				path,
				config,
			};
		}
		const routeSpecs = handlerDefinition[method.toLowerCase()];
		const newConfig = config ? R.clone(config) : {}; // eslint-disable-line

		newConfig.validate = newConfig.validate || {};
		if (routeSpecs.parameters) {
			newConfig.validate.params = this.createParameterValidator(getParams(routeSpecs.parameters));
			newConfig.validate.query = this.createParameterValidator(getQuery(routeSpecs.parameters));

			if (getBody(routeSpecs.parameters).length) {
				newConfig.validate.payload = createParameterValidator(getBody(routeSpecs.parameters)[0]);
			} else {
				newConfig.validate.payload = false;
			}
		}

		newConfig.response = this.createResponseValidator(routeSpecs.responses);

		return {
			method,
			path,
			config: newConfig,
		};
	}

	createParameterValidator(parameters) {
		// this.log.debug('createParamsValidation', params);
		if (!parameters.length) {
			return false;
		}
		const config = {};
		parameters.forEach((parameter) => {
			this.log.debug(`setup validation for parameter: "${parameter.name}" in "${parameter.in}"`);
			config[parameter.name] = createParameterValidator(parameter);
		});

		const schema = Joi.object(config);
		return schema;
	}

	createResponseValidator(responses) {
		const config = {
			status: {},
		};

		let haveSchema = false;
		Object.keys(responses).forEach((statusCode) => {
			if (statusCode === 'default') {
				this.log.warn('Unsupported responses key: "default" please specify concreate statusCode');
				return;
			}
			const schema = createResponseValidator(responses[statusCode]);
			if (schema !== null) {
				this.log.debug(`setup response validation for statusCode: "${statusCode}"`);
				config.status[statusCode] = schema;
				haveSchema = true;
			}
		});

		return haveSchema ? config : undefined;
	}

	getHandlerDefinition(path) {
		return this.serviceDefinition.paths[path];
	}
}

module.exports = AtrixSwagger;
