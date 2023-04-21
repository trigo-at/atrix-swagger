'use strict';

const SwaggerParser = require('swagger-parser');
const fs = require('fs');
const BaseJoi = require('joi');
const DateExtension = require('@joi/date');
const { filter, propEq, mergeLeft, clone, isEmpty } = require('ramda');
const { createParameterValidator, createResponseValidator } = require('./create-validator');

const Joi = BaseJoi.extend(DateExtension);

const getParams = filter(propEq('path', 'in'));
const getQuery = filter(propEq('query', 'in'));
const getHeaders = filter(propEq('header', 'in'));
const getBody = filter(propEq('body', 'in'));

const configSchema = Joi.object({
    serviceDefinition: Joi.string()
        .required()
        .description('Path to the service swagger config file'),
    responseValidationSample: Joi.number()
        .integer()
        .min(0)
        .max(100)
        .default(100)
        .description('Percentage of responses to validate'),
    responseValidationFailAction: Joi.string()
        .default('error')
        .valid('error', 'log', 'ignore')
        .description(
            'How respnse validation errors should be handled. See https://hapijs.com/tutorials/validation for details.'
        ),
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

        this.config = mergeLeft(clone(service.config.config), {
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

        this.log.debug(`register ${this.getPrefix()}/swagger.json`);
        httpEndpoint.instance.registerHandler(
            'GET',
            '/swagger.json',
            (req, reply) => {
                reply(this.serviceDefinition);
            },
            {
                cors: true,
            }
        );
    }

    async init() {
        await this.loadServiceDefinition();
    }

    async process(handlers) {
        // const retHandlers = handlers;
        for (const handler of handlers) {
            //eslint-disable-line
            const route = await this.setupServiceHandler(handler); //eslint-disable-line
            handler.method = route.method;
            handler.path = route.path;
            handler.options = route.options;
        }

        return handlers;
    }

    async loadServiceDefinition() {
        const parser = new SwaggerParser();
        this.serviceDefinition = await parser.dereference(this.config.swagger.serviceDefinition);
    }

    async setupServiceHandler({ method, path, options, config }) {
        this.log.debug(`setup handler for "${method} ${path}"`);
        console.log('OPTIONS =>')
        console.log(options)
        console.log('CONFIG =>')
        console.log(config)

        if (!options && config) {
            options = config; // eslint-disable-line no-param-reassign
        }

        console.log(options)


        const handlerDefinition = this.getHandlerDefinition(path);

        if (!handlerDefinition || !handlerDefinition[method.toLowerCase()]) {
            this.log.warn(`No Swagger specification found for route: ${method} ${path}`);
            return {
                method,
                path,
                options,
            };
        }
        const routeSpecs = handlerDefinition[method.toLowerCase()];

        if (routeSpecs.consumes && routeSpecs.consumes.indexOf('multipart/form-data') !== -1) {
            this.log.warn(`Unsupported "multipart/form-data": ${method} ${path} - no validations will be generated!`);
            return {
                method,
                path,
                options,
            };
        }
        const newConfig = options ? clone(options) : {};
        newConfig.validate = newConfig.validate || {};
        if (routeSpecs.parameters) {
            const swaggerParamsSchema = this.createParameterValidator(getParams(routeSpecs.parameters));

            const swaggerQuerySchema = this.createParameterValidator(getQuery(routeSpecs.parameters));

            const headerParameters = getHeaders(routeSpecs.parameters);
            if (headerParameters.length) {
                const swaggerHeadersSchema = this.createParameterValidator(headerParameters).unknown();

                newConfig.validate.headers = swaggerHeadersSchema;
            }

            newConfig.validate.params = swaggerParamsSchema;

            newConfig.validate.query = swaggerQuerySchema;

            if (getBody(routeSpecs.parameters).length) {
                newConfig.validate.payload = createParameterValidator(getBody(routeSpecs.parameters)[0]);
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
            options: newConfig,
        };
    }

    createParameterValidator(parameters) {
        if (!parameters.length) {
            return undefined;
        }
        const config = {};
        parameters.forEach(parameter => {
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
        Object.keys(responses).forEach(statusCode => {
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
