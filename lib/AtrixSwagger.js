'use strict';

const SwaggerParser = require('swagger-parser');
const fs = require('fs');
const BaseJoi = require('joi');
const DateExtension = require('joi-date-extensions');
const { filter, propEq, merge, clone, isEmpty } = require('ramda');
const { createParameterValidator, createResponseValidator } = require('./create-validator');

const Joi = BaseJoi.extend(DateExtension);

const getParams = filter(propEq('in', 'path'));
const getQuery = filter(propEq('in', 'query'));
const getHeaders = filter(propEq('in', 'header'));
const getBody = filter(propEq('in', 'body'));

const configSchema = Joi.object({
	serviceDefinition: Joi.string().required().description('Path to the service swagger config file'),
	responseValidationSample: Joi.number()
		.integer().min(0).max(100)
		.default(100)
		.description('Percentage of responses to validate'),
	responseValidationFailAction: Joi.string().default('error').valid('error', 'log', 'ignore').description('How respnse validation errors should be handled. See https://hapijs.com/tutorials/validation for details.'),
});

class AtrixSwagger {
	constructor(atrix, service) {
		this.atrix = atrix;
		this.service = service;
		this.log = this.service.log.child({ plugin: 'AtrixSwagger' });

		if (!service.config.config.swagger) {
			this.log.warn(`No "swagger" section found config of service "${this.service.name}"`);
			return;
		}

		this.config = merge(clone(service.config.config), {
			swagger: Joi.attempt(service.config.config.swagger, configSchema),
		});


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
			path: `${this.getPrefix()}/swagger.json`,
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
		if (routeSpecs.consumes && routeSpecs.consumes.indexOf('multipart/form-data') !== -1) {
			this.log.warn(`Unsupported "multipart/form-data": ${method} ${path} - no validations will be generated!`);
			return {
				method,
				path,
				config,
			};
		}
		const newConfig = config ? clone(config) : {}; // eslint-disable-line

		newConfig.validate = newConfig.validate || {};
		if (routeSpecs.parameters) {
			const swaggerParamsSchema = this.createParameterValidator(getParams(routeSpecs.parameters));
			const swaggerQuerySchema = this.createParameterValidator(getQuery(routeSpecs.parameters));

			const headerParameters = getHeaders(routeSpecs.parameters);
			if (headerParameters.length) {
				let swaggerHeadersSchema = this.createParameterValidator(headerParameters);

				// allow unknow header keys per default
				if (swaggerHeadersSchema) swaggerHeadersSchema = swaggerHeadersSchema.unknown();

				newConfig.validate.headers = this.patchSwaggerValidationRules(swaggerHeadersSchema,
					config && config.validate ? config.validate.headers : {});
			}

			newConfig.validate.params = this.patchSwaggerValidationRules(swaggerParamsSchema,
				config && config.validate ? config.validate.params : {});

			newConfig.validate.query = this.patchSwaggerValidationRules(swaggerQuerySchema,
				config && config.validate ? config.validate.query : {});

			if (getBody(routeSpecs.parameters).length) {
				newConfig.validate.payload = this.patchSwaggerValidationRules(createParameterValidator(getBody(routeSpecs.parameters)[0]),
					config && config.validate ? config.validate.payload : {});
				if (!getBody(routeSpecs.parameters)[0].required) {
					newConfig.validate.payload = newConfig.validate.payload.allow(null);
				}
			} else {
				newConfig.validate.payload = false;
			}
		}

		if (isEmpty(newConfig.validate)) {
			delete newConfig.validate;
		}

		if (routeSpecs.responses) {
			const response = this.createResponseValidator(routeSpecs.responses);
			if (response) {
				newConfig.response = response;
			}
		}

		return {
			method,
			path,
			config: newConfig,
		};
	}

	patchSwaggerValidationRules(swaggerSchema, handlerConfig) {
		if (!swaggerSchema) {
			return swaggerSchema;
		}
		if (handlerConfig === undefined) {
			return swaggerSchema;
		}
		if (!Object.keys(handlerConfig).length) {
			return swaggerSchema;
		}

		const patch = {};
		Object.keys(handlerConfig).forEach((key) => {
			if (handlerConfig[key] && handlerConfig[key].isJoi) {
				this.log.debug(`override schema key: "${key}" with custom joi schema ${JSON.stringify(handlerConfig[key])}`);
				patch[key] = handlerConfig[key];
			}
		});
		return swaggerSchema.keys(patch);
	}

	createParameterValidator(parameters) {
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
			sample: this.config.swagger.responseValidationSample,
			failAction: this.config.swagger.responseValidationFailAction,
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
		let definitionPath = path;
		if (this.getPrefix()) {
			definitionPath = path.replace(new RegExp(`^${this.config.endpoints.http.prefix}`), '');
			// console.log('Fix path: ', this.getPrefix(), path, definitionPath);
		}
		return this.serviceDefinition.paths[definitionPath];
	}

	getPrefix() {
		if (this.config.endpoints && this.config.endpoints.http && this.config.endpoints.http.prefix) {
			return this.config.endpoints.http.prefix;
		}
		return '';
	}
}

module.exports = AtrixSwagger;
